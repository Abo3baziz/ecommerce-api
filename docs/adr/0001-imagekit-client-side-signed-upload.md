# ADR-0001: Client-Side Signed Upload for Product and Variant Image Storage

- **Status:** Accepted
- **Date:** 2026-08-12
- **Decision makers:** Project maintainers
- **Related documents:**
  - `docs/api/products/product-images.md` — Image Upload (ImageKit) section
  - `docs/api/products/product-variant-images.md`
  - `docs/API_DESIGN.md` — Admin Product Image endpoints

---

## Context

The ecommerce system needs product and variant image storage. The backend is a REST API with no frontend and does not currently handle binary file uploads. Images are exposed to customers through the Product Catalog API, and are managed by administrators through admin-only endpoints.

The database persists image references as URLs only: `product_images.image_url` (max 2048 characters) and `product_variant_images.image_url`. Binary file bytes are never stored in the database.

The project selected **ImageKit** as the image CDN and storage provider. ImageKit offers three viable upload patterns:

1. **Server-side proxy upload** — the client sends the binary to the API (multipart/form-data), and the API forwards it to ImageKit using the private key, then returns the resulting URL to the client for registration.
2. **Client-side signed upload** — the API generates short-lived upload authentication parameters (`token`, `expire`, `signature`) from the private key and returns them to an authenticated admin client. The client uploads the binary directly to ImageKit using the public key and those parameters. ImageKit validates the signature server-side and returns the URL. The client then registers the URL with the API.
3. **Self-hosted storage** — the API stores binaries itself (local disk / object storage) and serves them through a CDN proxy.

The decision must preserve the following requirements:

- The ImageKit **private key must never be exposed to clients**.
- Uploads must be authorized by the existing session-based, role-based admin authentication.
- The API must not become a bandwidth or request-size bottleneck for image uploads.
- The flow must work for a browser-based admin frontend without a backend of its own.

---

## Decision

Adopt the **client-side signed upload** pattern for all image uploads (product images and variant images).

### Architecture

- The API stores **URLs only** and never receives binary image files.
- A single admin endpoint issues upload credentials: `GET /api/v1/admin/products/uploads/imagekit-auth`.
  - Requires an authenticated session with role `admin` or `super_admin`.
  - Returns `{ token, expire, signature, publicKey, urlEndpoint }`.
  - `token`, `expire`, and `signature` are computed server-side with `@imagekit/nodejs` (`imagekit.helper.getAuthenticationParameters()`), which derives the signature via HMAC from the private key. No network call is made.
  - `publicKey` and `urlEndpoint` come from environment configuration and are safe to expose.
- The client then uploads the file directly to ImageKit's upload API, passing the file, `publicKey`, `urlEndpoint`, `token`, `expire`, and `signature`. ImageKit validates the signature and returns the uploaded file's URL.
- The client finally registers the returned URL through the existing admin image endpoints (`POST /api/v1/admin/products/{product_public_id}/images` or the variant-image equivalent), which validate the URL shape (`http`/`https`, max 2048 characters).

### Implementation notes

- Shared module: `src/shared/imagekit/` (`client.ts` builds the SDK instance from `IMAGEKIT_PRIVATE_KEY`; `auth.ts` wraps `getAuthenticationParameters()`; `index.ts` re-exports).
- Environment: `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT` are validated at startup by the env schema.
- Controller (`src/modules/products/controller/upload.controller.ts`) is a thin adapter that joins the auth parameters with the public key and URL endpoint.

---

## Alternatives considered

### Server-side proxy upload

- **Pros:** Signature and private key handling stay entirely server-side; the API could theoretically validate the file before persisting; no client SDK required.
- **Cons:** The API becomes a bandwidth and latency bottleneck for large image files; express/JSON middleware does not parse multipart by default, so new parsing dependencies, size limits, and temporary-file handling would be required; uploads would double-traverse the network (client → API → ImageKit); more attack surface and more code to maintain. Rejected.

### Self-hosted storage / local disk

- **Pros:** Full control, no third-party dependency.
- **Cons:** Significant operational burden (storage provisioning, backups, scaling), no built-in CDN/transformation pipeline, and outside the project's scope of using ImageKit as the managed media service. Rejected.

### Uploads stored directly as URLs with no credential endpoint (fully client-generated)

- **Pros:** Simplest server change.
- **Cons:** Anyone with the public key could upload arbitrary files to the ImageKit media library without an authenticated session; the credential endpoint is what ties upload authorization to the API's admin authentication. Rejected.

---

## Consequences

### Positive

- The API never handles image binaries — no multipart parsing, no request-size limits, no temporary storage, and no bandwidth cost through the API.
- The ImageKit private key is never exposed; only a short-lived HMAC signature and the public key leave the server.
- Uploads are authorized by the existing session + admin role middleware, so only authenticated administrators can obtain upload credentials.
- ImageKit serves the images from its CDN, and the API only stores the resulting URLs.
- Works from a browser-only admin frontend with no additional backend.

### Negative

- The upload signature is not scoped to a specific ImageKit folder by default; the API cannot cryptographically bind an uploaded file to a particular product. Mitigation: only admin-authenticated clients can obtain credentials, and the API only persists URLs that pass URL-shape validation; the caller is responsible for uploading into the intended ImageKit folder.
- The API trusts the URL the client submits as `image_url`. It validates the URL is an absolute `http`/`https` URL (preventing protocol smuggling such as `javascript:` or `file:`) but cannot verify the URL actually corresponds to a file uploaded by this session. This is an accepted trust trade-off for the admin surface.
- Deleting an image record (hard delete) does not delete the file in ImageKit; orphan-file cleanup in the media library is the caller's responsibility. This matches the documented API behavior.
- The signature expires (`expire`), so clients must complete the upload within the validity window; a failed/expired upload requires fetching fresh credentials.

---

## Compliance

- `docs/api/products/product-images.md` documents the endpoint contract and the 3-step upload flow.
- `docs/API_DESIGN.md` registers the endpoint.
- E2E coverage: `tests/e2e/products/image-upload.api.test.ts` (401 without a session, 403 for non-admin, 200 admin with the expected response shape).
