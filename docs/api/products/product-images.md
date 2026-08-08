# Product Images API

## Overview

The Product Images API manages images associated with a product as a whole. These images represent the product and are shared across all of its variants (for example, the hero shot or lifestyle photos of a headphones product).

Images are managed exclusively by administrators through endpoints nested under their parent product. Customers consume product images embedded in the product detail response of the Products API.

Variant-specific images are a separate resource and are documented in the Product Variant Images API: `docs/api/products/product-variant-images.md`.

---

# Product Image Object

```json
{
  "public_id": "pimg_01K4X8Y9P4M4G8N6F9V2A1B3C",
  "product_public_id": "prd_01K4X8Y9P4M4G8N6F9V2A1B3C",
  "image_url": "https://cdn.example.com/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/hero.jpg",
  "alt_text": "Wireless headphones in black",
  "display_order": 1,
  "is_primary": true,
  "created_at": "2026-08-01T11:00:00Z",
  "updated_at": "2026-08-01T11:00:00Z"
}
```

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| public_id | string | No | Public image identifier (`pimg_…` prefix) |
| product_public_id | string | No | Public identifier of the parent product |
| image_url | string | No | URL of the stored image (max 2048 characters) |
| alt_text | string | Yes | Alternative text describing the image (max 255 characters) |
| display_order | integer | No | Display order of the image within the product gallery |
| is_primary | boolean | No | Indicates whether this image is the product's primary image. Exactly one image per product is flagged `true` |
| created_at | string | No | Creation timestamp (ISO 8601) |
| updated_at | string | No | Last modification timestamp (ISO 8601) |

The primary image is the default/hero image of the product and is the first image customers see. The primary flag is service-enforced: exactly one image per product is primary at any time.

---

# Admin Image Management

All endpoints require an authenticated session with the `admin` role.

## List Product Images

Returns the images of a product ordered by `display_order` ascending.

## Endpoint

```http
GET /api/v1/admin/products/{product_public_id}/images
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
      "public_id": "pimg_01K4X8Y9P4M4G8N6F9V2A1B3C",
      "product_public_id": "prd_01K4X8Y9P4M4G8N6F9V2A1B3C",
      "image_url": "https://cdn.example.com/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/hero.jpg",
      "alt_text": "Wireless headphones in black",
      "display_order": 1,
      "is_primary": true,
      "created_at": "2026-08-01T11:00:00Z",
      "updated_at": "2026-08-01T11:00:00Z"
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

1. Client sends the request with the session cookie and product public ID.
2. API authenticates the session and authorizes the `admin` role.
3. API resolves the public ID to the internal product ID and verifies the product exists and is not soft-deleted.
4. API loads the product's images ordered by `display_order` ascending.
5. API returns **200 OK** with the image list and pagination metadata.

---

## Business Rules

- The parent product must exist and not be soft-deleted; otherwise **404 Not Found**.
- Images are always ordered by `display_order` ascending; the primary flag (`is_primary = true`) marks the product's hero image.
- Images are hard-deleted resources: soft-deleted products hide their images from all reads, but the image records themselves are not deleted when the product is soft-deleted.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid query parameter value |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated user is not an admin |
| 404 Not Found | Parent product does not exist or is soft-deleted |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Requires a valid authenticated session and the `admin` role.
- `image_url` values are stored and returned as opaque URLs; the API does not proxy or validate image file contents.

---

## Notes

- Variant-specific images are managed through the Product Variant Images API.

---

## Create Product Image

Adds an image to a product's gallery.

## Endpoint

```http
POST /api/v1/admin/products/{product_public_id}/images
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

---

## Query Parameters

> None.

---

## Request Body

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| image_url | string | Yes | Absolute `http`/`https` URL, max 2048 characters |
| alt_text | string | No | Max 255 characters |
| display_order | integer | No | Integer ≥ 0, unique within the product. Default: current max + 1 |
| is_primary | boolean | No | Whether this image becomes the primary image. Default: `false` (the first image added to a product automatically becomes primary) |

### Example

```json
{
  "image_url": "https://cdn.example.com/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/hero.jpg",
  "alt_text": "Wireless headphones in black",
  "display_order": 1,
  "is_primary": true
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
    "public_id": "pimg_01K4X8Y9P4M4G8N6F9V2A1B3C",
    "product_public_id": "prd_01K4X8Y9P4M4G8N6F9V2A1B3C",
    "image_url": "https://cdn.example.com/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/hero.jpg",
    "alt_text": "Wireless headphones in black",
    "display_order": 1,
    "is_primary": true,
    "created_at": "2026-08-03T10:00:00Z",
    "updated_at": "2026-08-03T10:00:00Z"
  }
}
```

### Response Headers

> None.

---

## Processing Flow

1. Client sends the request with the session cookie, product public ID, and JSON body.
2. API authenticates the session and authorizes the `admin` role.
3. API validates the request body (`image_url` format, `alt_text` length, `display_order`, `is_primary`).
4. API resolves the public ID to the internal product ID and verifies the product exists and is not soft-deleted.
5. API assigns `display_order` (provided value or current max + 1) and verifies it is unique within the product.
6. If `is_primary = true` (or this is the product's first image), the API clears the primary flag on all other images of the product in the same transaction, then creates the new image as primary.
7. API generates a public ID and creates the image record.
8. API returns **201 Created** with the Product Image Object.

---

## Business Rules

- `image_url` must be an absolute `http`/`https` URL, max 2048 characters.
- `display_order` must be ≥ 0 and unique within the product; a duplicate returns **409 Conflict** (`DISPLAY_ORDER_CONFLICT`).
- When `display_order` is omitted, the new image is appended after the highest existing order.
- Adding the first image to a product automatically makes it the primary image.
- When a new image is flagged `is_primary = true`, the API clears the flag on the previous primary image; exactly one image per product is primary at any time.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid request body |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated user is not an admin |
| 404 Not Found | Parent product does not exist or is soft-deleted |
| 409 Conflict | `display_order` already in use within the product |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Requires a valid authenticated session and the `admin` role.
- `image_url` is validated as a well-formed `http`/`https` URL to prevent protocol smuggling (e.g., `javascript:` or `file:` URLs).

---

## Notes

- The API stores image URLs; uploading binary image files is out of scope (use a dedicated storage service and store the resulting URL).

---

## Get Product Image

Returns a single image of a product.

## Endpoint

```http
GET /api/v1/admin/products/{product_public_id}/images/{image_public_id}
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
| image_public_id | string | Yes | Public image identifier (`pimg_…`) |

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
    "public_id": "pimg_01K4X8Y9P4M4G8N6F9V2A1B3C",
    "product_public_id": "prd_01K4X8Y9P4M4G8N6F9V2A1B3C",
    "image_url": "https://cdn.example.com/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/hero.jpg",
    "alt_text": "Wireless headphones in black",
    "display_order": 1,
    "is_primary": true,
    "created_at": "2026-08-01T11:00:00Z",
    "updated_at": "2026-08-01T11:00:00Z"
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
4. API resolves the image public ID and verifies the image belongs to the product.
5. API returns **200 OK** with the Product Image Object.

---

## Business Rules

- The image must belong to the parent product identified in the path; otherwise **404 Not Found**.
- An image of a soft-deleted product is not reachable (**404 Not Found**).

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Malformed public ID |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated user is not an admin |
| 404 Not Found | Product or image does not exist, the product is soft-deleted, or the image does not belong to the product |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Requires a valid authenticated session and the `admin` role.
- The membership check between image and product prevents cross-product access.

---

## Notes

- Image records are hard-deleted resources and carry no `deleted_at`; deletion is permanent (see Delete Product Image).

---

## Update Product Image

Updates editable fields of a product image. Partial update semantics: only the provided fields are changed.

## Endpoint

```http
PATCH /api/v1/admin/products/{product_public_id}/images/{image_public_id}
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
| image_public_id | string | Yes | Public image identifier (`pimg_…`) |

---

## Query Parameters

> None.

---

## Request Body

All fields are optional and follow the same validation rules as Create Product Image.

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| image_url | string | No | Absolute `http`/`https` URL, max 2048 characters |
| alt_text | string | No | Max 255 characters; `null` clears the value |
| display_order | integer | No | Integer ≥ 0, unique within the product |
| is_primary | boolean | No | Whether this image becomes the primary image; setting it to `true` demotes the current primary image |

### Example

```json
{
  "alt_text": "Wireless headphones in black, hero shot",
  "is_primary": true
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
    "public_id": "pimg_01K4X8Y9P4M4G8N6F9V2A1B3C",
    "product_public_id": "prd_01K4X8Y9P4M4G8N6F9V2A1B3C",
    "image_url": "https://cdn.example.com/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/hero.jpg",
    "alt_text": "Wireless headphones in black, hero shot",
    "display_order": 1,
    "is_primary": true,
    "created_at": "2026-08-01T11:00:00Z",
    "updated_at": "2026-08-04T15:00:00Z"
  }
}
```

### Response Headers

> None.

---

## Processing Flow

1. Client sends the request with the session cookie, both public IDs, and JSON body.
2. API authenticates the session and authorizes the `admin` role.
3. API validates the request body.
4. API resolves the product and image, verifying existence and membership.
5. API verifies `display_order` uniqueness within the product if provided.
6. If `is_primary = true`, the API clears the primary flag on all other images of the product in the same transaction.
7. API updates only the provided fields and refreshes `updated_at`.
8. API returns **200 OK** with the updated Product Image Object.

---

## Business Rules

- `display_order` must be unique within the product; a conflict returns **409 Conflict** (`DISPLAY_ORDER_CONFLICT`).
- `alt_text` accepts `null` to clear its value.
- Setting `is_primary = true` demotes the previous primary image; exactly one image per product is primary at any time. The primary flag cannot be cleared on the only image of a product (`is_primary = false` on the sole image returns **400 Bad Request**).
- Reordering via `display_order` does not change the primary flag.
- The image must belong to the parent product; otherwise **404 Not Found**.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid request body, or attempting to clear the primary flag on the product's only image |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated user is not an admin |
| 404 Not Found | Product or image does not exist, the product is soft-deleted, or the image does not belong to the product |
| 409 Conflict | `display_order` already in use within the product |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Requires a valid authenticated session and the `admin` role.
- `image_url` is validated as a well-formed `http`/`https` URL on update as well as on create.

---

## Notes

- Reordering is performed one image at a time; bulk reorder is not part of this API.

---

## Delete Product Image

Permanently removes an image from a product's gallery.

Image records have no `deleted_at` column: deletion is a hard delete. Image URLs in external storage are not deleted by the API; storage cleanup is the responsibility of the caller.

## Endpoint

```http
DELETE /api/v1/admin/products/{product_public_id}/images/{image_public_id}
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
| image_public_id | string | Yes | Public image identifier (`pimg_…`) |

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

1. Client sends the request with the session cookie and both public IDs.
2. API authenticates the session and authorizes the `admin` role.
3. API resolves the product and image, verifying existence and membership.
4. If the image is the product's primary image, the API promotes the remaining image with the lowest `display_order` to primary (in the same transaction).
5. API deletes the image record.
6. API returns **204 No Content**.

---

## Business Rules

- The image must belong to the parent product; otherwise **404 Not Found**.
- Deleting the primary image promotes the remaining image with the lowest `display_order` to primary; the product always keeps exactly one primary image as long as at least one image remains.
- Deleting an image never deletes variant images, which are a separate resource.
- The parent product must not be soft-deleted; images of soft-deleted products are not reachable.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Malformed public ID |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated user is not an admin |
| 404 Not Found | Product or image does not exist, the product is soft-deleted, or the image does not belong to the product |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Requires a valid authenticated session and the `admin` role.
- Deletion is permanent; the image record cannot be recovered through the API.

---

## Notes

- Deleting a product (soft delete) does not delete its image records; they remain in storage and are simply hidden.

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
    "code": "DISPLAY_ORDER_CONFLICT",
    "message": "Another image of this product already uses display order 2."
  }
}
```

---

# Notes

- Internal database IDs are never exposed; public IDs identify all resources externally.
- Timestamps are ISO 8601 UTC.
- Images are always addressed through their parent product path.

---

# Design Decisions

- **Admin-only resource** — Customers never manage product images directly; they consume them embedded in the product detail response of the Products API.
- **Hard delete** — The `product_images` table has no `deleted_at` column, and images are not referenced by historical business records, so deletion is permanent. This matches the schema and differs from products/variants, which are soft-deleted.
- **`display_order` uniqueness within the parent** — Enforced by the service to guarantee a total ordering of the gallery; conflicts return 409. When omitted, the order is computed as the current max + 1.
- **Primary image via `is_primary` flag** — The primary (hero) image is flagged by the `product_images.is_primary` column rather than derived from `display_order`. The service enforces the "exactly one primary per product" invariant in a transaction: creating/updating with `is_primary = true` demotes the previous primary, the first image added becomes primary automatically, and deleting the primary promotes the remaining image with the lowest `display_order`. This matches the schema and gives the storefront an explicit hero image.
- **URL-only storage** — The API stores and returns image URLs; binary uploads are delegated to a storage service (out of scope).
- **Response envelope** — All responses use the shared `{ success: true, data }` wrapper with the standard `pagination` object on list endpoints.
