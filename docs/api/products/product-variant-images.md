# Product Variant Images API

## Overview

The Product Variant Images API manages images specific to individual product variants. These images represent attributes unique to a variant — such as color, material, or style — and supplement or override the product's shared images.

For example, a headphones product may have a shared hero image plus a per-variant image showing the "Black" variant's finish.

Images are managed exclusively by administrators through endpoints nested under their parent variant. Customers consume variant images embedded in each variant of the product detail response of the Products API.

Product-level (shared) images are a separate resource and are documented in the Product Images API: `docs/api/products/product-images.md`.

Variant image files are uploaded to ImageKit using the same client-side signed upload flow as product images (see the **Image Upload (ImageKit)** section of `docs/api/products/product-images.md`); the resulting URL is then submitted as `image_url` to the endpoints below.

---

# Product Variant Image Object

```json
{
  "public_id": "vimg_01K4X8Y9P4M4G8N6F9V2A1B3C",
  "product_variant_public_id": "var_01K4X8Y9P4M4G8N6F9V2A1B3C",
  "image_url": "https://cdn.example.com/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/var_01K4X8Y9P4M4G8N6F9V2A1B3C/black-side.jpg",
  "alt_text": "Wireless headphones in black, side view",
  "display_order": 1
}
```

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| public_id | string | No | Public image identifier (`vimg_…` prefix) |
| product_variant_public_id | string | No | Public identifier of the parent variant |
| image_url | string | No | URL of the stored image (max 2048 characters) |
| alt_text | string | Yes | Alternative text describing the image (max 255 characters) |
| display_order | integer | No | Display order of the image within the variant gallery |

> Note: the `product_variant_images` table has no `created_at`/`updated_at` columns in the schema; the object carries no timestamps.

---

# Admin Variant Image Management

All endpoints require an authenticated session with the `admin` role.

## List Variant Images

Returns the images of a variant ordered by `display_order` ascending.

## Endpoint

```http
GET /api/v1/admin/products/{product_public_id}/variants/{variant_public_id}/images
```

---

## Authentication

| Requirement | Value |
|-------------|-------|
| Authentication | Required |

---

## Authorization

Authenticated user with role `admin`. Non-admin sessions receive **403 Forbidden**.

---

## Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| Cookie | Yes | Session cookie (`session=…`) issued at login |

---

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| product_public_id | string | Yes | Public product identifier (`prd_…`) |
| variant_public_id | string | Yes | Public variant identifier (`var_…`) |

---

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | integer | No | Page number, 1-based. Default: `1` |
| limit | integer | No | Page size. Default: `20`, max: `100` |

---

## Request Body

> None.

---

## Successful Response

**200 OK**

### Response Body

```json
{
  "success": true,
  "data": [
    {
      "public_id": "vimg_01K4X8Y9P4M4G8N6F9V2A1B3C",
      "product_variant_public_id": "var_01K4X8Y9P4M4G8N6F9V2A1B3C",
      "image_url": "https://cdn.example.com/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/var_01K4X8Y9P4M4G8N6F9V2A1B3C/black-side.jpg",
      "alt_text": "Wireless headphones in black, side view",
      "display_order": 1
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

### Response Headers

> None.

---

## Processing Flow

1. Client sends the request with the session cookie and both public IDs.
2. API authenticates the session and authorizes the `admin` role.
3. API resolves the product public ID and verifies the product exists and is not soft-deleted.
4. API resolves the variant public ID, verifies it belongs to the product, and is not soft-deleted.
5. API loads the variant's images ordered by `display_order` ascending.
6. API returns **200 OK** with the image list and pagination metadata.

---

## Business Rules

- The parent variant must belong to the parent product; otherwise **404 Not Found**.
- The parent product and variant must not be soft-deleted; otherwise **404 Not Found**.
- Images are always ordered by `display_order` ascending.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid query parameter value |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated user is not an admin |
| 404 Not Found | Product or variant does not exist, is soft-deleted, or the variant does not belong to the product |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Requires a valid authenticated session and the `admin` role.
- `image_url` values are stored and returned as opaque URLs; the API does not proxy or validate image file contents.

---

## Notes

- Variant images are distinct from product images; both galleries are merged by the client when rendering a product page.

---

## Create Variant Image

Adds an image to a variant's gallery.

## Endpoint

```http
POST /api/v1/admin/products/{product_public_id}/variants/{variant_public_id}/images
```

---

## Authentication

| Requirement | Value |
|-------------|-------|
| Authentication | Required |

---

## Authorization

Authenticated user with role `admin`. Non-admin sessions receive **403 Forbidden**.

---

## Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| Content-Type | Yes | `application/json` |
| Cookie | Yes | Session cookie (`session=…`) issued at login |

---

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| product_public_id | string | Yes | Public product identifier (`prd_…`) |
| variant_public_id | string | Yes | Public variant identifier (`var_…`) |

---

## Query Parameters

> None.

---

## Request Body

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| image_url | string | Yes | Absolute `http`/`https` URL, max 2048 characters |
| alt_text | string | No | Max 255 characters |
| display_order | integer | No | Integer ≥ 0, unique within the variant. Default: current max + 1 |

### Example

```json
{
  "image_url": "https://cdn.example.com/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/var_01K4X8Y9P4M4G8N6F9V2A1B3C/black-side.jpg",
  "alt_text": "Wireless headphones in black, side view",
  "display_order": 1
}
```

---

## Successful Response

**201 Created**

### Response Body

```json
{
  "success": true,
  "data": {
    "public_id": "vimg_01K4X8Y9P4M4G8N6F9V2A1B3C",
    "product_variant_public_id": "var_01K4X8Y9P4M4G8N6F9V2A1B3C",
    "image_url": "https://cdn.example.com/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/var_01K4X8Y9P4M4G8N6F9V2A1B3C/black-side.jpg",
    "alt_text": "Wireless headphones in black, side view",
    "display_order": 1
  }
}
```

### Response Headers

> None.

---

## Processing Flow

1. Client sends the request with the session cookie, both public IDs, and JSON body.
2. API authenticates the session and authorizes the `admin` role.
3. API validates the request body (`image_url` format, `alt_text` length, `display_order`).
4. API resolves the product and variant, verifying existence, membership, and non-deletion.
5. API assigns `display_order` (provided value or current max + 1) and verifies it is unique within the variant.
6. API generates a public ID and creates the image record.
7. API returns **201 Created** with the Product Variant Image Object.

---

## Business Rules

- `image_url` must be an absolute `http`/`https` URL, max 2048 characters.
- `display_order` must be ≥ 0 and unique within the variant; a duplicate returns **409 Conflict** (`DISPLAY_ORDER_CONFLICT`).
- When `display_order` is omitted, the new image is appended after the highest existing order.
- The parent variant must be non-deleted and belong to the parent product; otherwise **404 Not Found**.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid request body |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated user is not an admin |
| 404 Not Found | Product or variant does not exist, is soft-deleted, or the variant does not belong to the product |
| 409 Conflict | `display_order` already in use within the variant |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Requires a valid authenticated session and the `admin` role.
- `image_url` is validated as a well-formed `http`/`https` URL to prevent protocol smuggling.

---

## Notes

- The API stores image URLs; uploading binary image files is out of scope (see the ImageKit upload flow in `docs/api/products/product-images.md`).

---

## Get Variant Image

Returns a single image of a variant.

## Endpoint

```http
GET /api/v1/admin/products/{product_public_id}/variants/{variant_public_id}/images/{variant_image_public_id}
```

---

## Authentication

| Requirement | Value |
|-------------|-------|
| Authentication | Required |

---

## Authorization

Authenticated user with role `admin`. Non-admin sessions receive **403 Forbidden**.

---

## Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| Cookie | Yes | Session cookie (`session=…`) issued at login |

---

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| product_public_id | string | Yes | Public product identifier (`prd_…`) |
| variant_public_id | string | Yes | Public variant identifier (`var_…`) |
| variant_image_public_id | string | Yes | Public variant image identifier (`vimg_…`) |

---

## Query Parameters

> None.

---

## Request Body

> None.

---

## Successful Response

**200 OK**

### Response Body

```json
{
  "success": true,
  "data": {
    "public_id": "vimg_01K4X8Y9P4M4G8N6F9V2A1B3C",
    "product_variant_public_id": "var_01K4X8Y9P4M4G8N6F9V2A1B3C",
    "image_url": "https://cdn.example.com/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/var_01K4X8Y9P4M4G8N6F9V2A1B3C/black-side.jpg",
    "alt_text": "Wireless headphones in black, side view",
    "display_order": 1
  }
}
```

### Response Headers

> None.

---

## Processing Flow

1. Client sends the request with the session cookie and all three public IDs.
2. API authenticates the session and authorizes the `admin` role.
3. API resolves the product and variant, verifying existence, membership, and non-deletion.
4. API resolves the image public ID and verifies the image belongs to the variant.
5. API returns **200 OK** with the Product Variant Image Object.

---

## Business Rules

- The image must belong to the variant identified in the path; otherwise **404 Not Found**.
- The parent variant and product must not be soft-deleted; otherwise **404 Not Found**.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Malformed public ID |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated user is not an admin |
| 404 Not Found | Product, variant, or image does not exist, a parent is soft-deleted, or the image does not belong to the variant |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Requires a valid authenticated session and the `admin` role.
- The membership checks across product → variant → image prevent cross-resource access.

---

## Notes

- Image records are hard-deleted resources and carry no `deleted_at`.

---

## Update Variant Image

Updates editable fields of a variant image. Partial update semantics: only the provided fields are changed.

## Endpoint

```http
PATCH /api/v1/admin/products/{product_public_id}/variants/{variant_public_id}/images/{variant_image_public_id}
```

---

## Authentication

| Requirement | Value |
|-------------|-------|
| Authentication | Required |

---

## Authorization

Authenticated user with role `admin`. Non-admin sessions receive **403 Forbidden**.

---

## Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| Content-Type | Yes | `application/json` |
| Cookie | Yes | Session cookie (`session=…`) issued at login |

---

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| product_public_id | string | Yes | Public product identifier (`prd_…`) |
| variant_public_id | string | Yes | Public variant identifier (`var_…`) |
| variant_image_public_id | string | Yes | Public variant image identifier (`vimg_…`) |

---

## Query Parameters

> None.

---

## Request Body

All fields are optional and follow the same validation rules as Create Variant Image.

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| image_url | string | No | Absolute `http`/`https` URL, max 2048 characters |
| alt_text | string | No | Max 255 characters; `null` clears the value |
| display_order | integer | No | Integer ≥ 0, unique within the variant |

### Example

```json
{
  "alt_text": "Wireless headphones in black, side view (v2)",
  "display_order": 2
}
```

---

## Successful Response

**200 OK**

### Response Body

```json
{
  "success": true,
  "data": {
    "public_id": "vimg_01K4X8Y9P4M4G8N6F9V2A1B3C",
    "product_variant_public_id": "var_01K4X8Y9P4M4G8N6F9V2A1B3C",
    "image_url": "https://cdn.example.com/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/var_01K4X8Y9P4M4G8N6F9V2A1B3C/black-side.jpg",
    "alt_text": "Wireless headphones in black, side view (v2)",
    "display_order": 2
  }
}
```

### Response Headers

> None.

---

## Processing Flow

1. Client sends the request with the session cookie, all three public IDs, and JSON body.
2. API authenticates the session and authorizes the `admin` role.
3. API validates the request body.
4. API resolves the product, variant, and image, verifying existence and membership.
5. API verifies `display_order` uniqueness within the variant if provided.
6. API updates only the provided fields.
7. API returns **200 OK** with the updated Product Variant Image Object.

---

## Business Rules

- `display_order` must be unique within the variant; a conflict returns **409 Conflict** (`DISPLAY_ORDER_CONFLICT`).
- `alt_text` accepts `null` to clear its value.
- The image must belong to the variant identified in the path; otherwise **404 Not Found**.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid request body |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated user is not an admin |
| 404 Not Found | Product, variant, or image does not exist, a parent is soft-deleted, or the image does not belong to the variant |
| 409 Conflict | `display_order` already in use within the variant |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Requires a valid authenticated session and the `admin` role.
- `image_url` is validated as a well-formed `http`/`https` URL on update as well as on create.

---

## Notes

- Reordering is performed one image at a time; bulk reorder is not part of this API.
- The variant image object carries no timestamps because the `product_variant_images` table has no `created_at`/`updated_at` columns.

---

## Delete Variant Image

Permanently removes an image from a variant's gallery.

Image records have no `deleted_at` column: deletion is a hard delete. Image URLs in external storage are not deleted by the API; storage cleanup is the responsibility of the caller.

## Endpoint

```http
DELETE /api/v1/admin/products/{product_public_id}/variants/{variant_public_id}/images/{variant_image_public_id}
```

---

## Authentication

| Requirement | Value |
|-------------|-------|
| Authentication | Required |

---

## Authorization

Authenticated user with role `admin`. Non-admin sessions receive **403 Forbidden**.

---

## Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| Cookie | Yes | Session cookie (`session=…`) issued at login |

---

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| product_public_id | string | Yes | Public product identifier (`prd_…`) |
| variant_public_id | string | Yes | Public variant identifier (`var_…`) |
| variant_image_public_id | string | Yes | Public variant image identifier (`vimg_…`) |

---

## Query Parameters

> None.

---

## Request Body

> None.

---

## Successful Response

**204 No Content**

### Response Body

> None.

### Response Headers

> None.

---

## Processing Flow

1. Client sends the request with the session cookie and all three public IDs.
2. API authenticates the session and authorizes the `admin` role.
3. API resolves the product, variant, and image, verifying existence and membership.
4. API deletes the image record.
5. API returns **204 No Content**.

---

## Business Rules

- The image must belong to the variant identified in the path; otherwise **404 Not Found**.
- The parent variant and product must not be soft-deleted; otherwise **404 Not Found**.
- Deleting an image never deletes product images, which are a separate resource.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Malformed public ID |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated user is not an admin |
| 404 Not Found | Product, variant, or image does not exist, a parent is soft-deleted, or the image does not belong to the variant |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Requires a valid authenticated session and the `admin` role.
- Deletion is permanent; the image record cannot be recovered through the API.

---

## Notes

- Soft-deleting a variant or product does not delete its image records; they remain in storage and are simply hidden.

---

# Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid request body or query parameters |
| 401 Unauthorized | Authentication required |
| 403 Forbidden | Insufficient permissions (non-admin) |
| 404 Not Found | Resource not found |
| 409 Conflict | `display_order` conflict |
| 500 Internal Server Error | Unexpected server error |

Error responses use the shared format:

```json
{
  "error": {
    "code": "VARIANT_IMAGE_NOT_FOUND",
    "message": "The requested variant image was not found."
  }
}
```

---

# Notes

- Internal database IDs are never exposed; public IDs identify all resources externally.
- Timestamps are ISO 8601 UTC; the variant image object itself carries no timestamps (see Notes on the object definition).
- Variant images are always addressed through their parent product and variant path.

---

# Design Decisions

- **Admin-only resource** — Customers never manage variant images directly; they consume them embedded in each variant of the product detail response of the Products API.
- **Three-level nesting** — Variant images are addressed as `/admin/products/{product_public_id}/variants/{variant_public_id}/images/{variant_image_public_id}`. This deviates from the "maximum two levels of nesting" guideline because a variant image has no meaning outside its variant, and the parent path makes the full hierarchy explicit and verifiable on every request. Membership is enforced at every level (product → variant → image).
- **Hard delete** — The `product_variant_images` table has no `deleted_at` column, and images are not referenced by historical business records, so deletion is permanent. This matches the schema and differs from products/variants, which are soft-deleted.
- **No timestamps** — The `product_variant_images` table has no `created_at`/`updated_at` columns in the schema, so the object and responses carry no timestamps (unlike product images). This is an intentional deviation from the Common Columns convention and is reflected in `docs/DATABASE.md`.
- **`display_order` uniqueness within the parent variant** — Enforced by the service to guarantee a total ordering of the variant gallery; conflicts return 409. When omitted, the order is computed as the current max + 1.
- **URL-only storage** — The API stores and returns image URLs; binary uploads are delegated to ImageKit via the client-side signed upload flow (see `docs/api/products/product-images.md`). The API never receives image file bytes.
- **Response envelope** — All responses use the shared `{ success: true, data }` wrapper with the standard `pagination` object on list endpoints.
