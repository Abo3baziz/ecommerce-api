# Products API

## Overview

The Products API manages the product catalog. A product is the parent entity for one or more purchasable variants and holds data shared across all variants (name, slug, description, brand, and lifecycle state).

The API is split into two surfaces:

- **Customer catalog** — public, read-only endpoints used by the storefront to browse and view products.
- **Admin management** — protected endpoints used by administrators to create, update, list, and delete products.

Variants, product images, and variant images are managed by their own dedicated APIs:

- Product Variants API: `docs/api/products/product-variants.md`
- Product Images API: `docs/api/products/product-images.md`
- Product Variant Images API: `docs/api/products/product-variant-images.md`

Authentication and session management are handled by the Authentication API.

---

# Product Object

```json
{
  "public_id": "prd_01K4X8Y9P4M4G8N6F9V2A1B3C",
  "slug": "wireless-noise-cancelling-headphones",
  "name": "Wireless Noise-Cancelling Headphones",
  "description": "Premium over-ear headphones with active noise cancellation and 40-hour battery life.",
  "brand": "SoundWave",
  "created_at": "2026-08-01T10:00:00Z",
  "updated_at": "2026-08-01T10:00:00Z"
}
```

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| public_id | string | No | Public product identifier (`prd_…` prefix) |
| slug | string | No | SEO-friendly unique URL slug |
| name | string | No | Product name |
| description | string | Yes | Detailed product description |
| brand | string | Yes | Product brand or manufacturer |
| created_at | string | No | Creation timestamp (ISO 8601) |
| updated_at | string | No | Last modification timestamp (ISO 8601) |

> Note: products have no activation flag. Customer visibility is derived from the lifecycle state (`deleted_at` is null) and the presence of at least one `ACTIVE` non-deleted variant (see Business Rules).

## Product Detail Object

The product detail response embeds the product's active variants and product images:

```json
{
  "public_id": "prd_01K4X8Y9P4M4G8N6F9V2A1B3C",
  "slug": "wireless-noise-cancelling-headphones",
  "name": "Wireless Noise-Cancelling Headphones",
  "description": "Premium over-ear headphones with active noise cancellation and 40-hour battery life.",
  "brand": "SoundWave",
  "created_at": "2026-08-01T10:00:00Z",
  "updated_at": "2026-08-02T09:00:00Z",
  "variants": [
    {
      "public_id": "var_01K4X8Y9P4M4G8N6F9V2A1B3C",
      "sku": "SW-HP-001-BLK-M",
      "color": "Black",
      "size": "M",
      "price": "129.99",
      "discount_percentage": "10.00",
      "final_price": "116.99",
      "weight": "0.25",
      "images": [
        {
          "public_id": "vimg_01K4X8Y9P4M4G8N6F9V2A1B3C",
          "image_url": "https://cdn.example.com/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/var_01K4X8Y9P4M4G8N6F9V2A1B3C/black-side.jpg",
          "alt_text": "Wireless headphones in black, side view",
          "display_order": 1
        }
      ]
    }
  ],
  "images": [
    {
      "public_id": "pimg_01K4X8Y9P4M4G8N6F9V2A1B3C",
      "image_url": "https://cdn.example.com/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/hero.jpg",
      "alt_text": "Wireless headphones in black",
      "display_order": 1,
      "is_primary": true
    }
  ]
}
```

The embedded variant object is the **customer-facing variant** shape: internal fields (`cost_price`, dimensions, `status`, `barcode`) are excluded, and the computed `final_price` is provided.

---

# Customer Catalog

## List Products

Returns a paginated list of products available for purchase. Only non-deleted products that have at least one non-deleted variant with `status = ACTIVE` are returned.

## Endpoint

```http
GET /api/v1/products
```

---

## Authentication

| Requirement | Value |
|-------------|-------|
| Authentication | Not Required |

---

## Authorization

None. Public endpoint.

---

## Request Headers

> None.

---

## Path Parameters

> None.

---

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | integer | No | Page number, 1-based. Default: `1` |
| limit | integer | No | Page size. Default: `20`, max: `100` |
| search | string | No | Case-insensitive substring match against `name`, `brand`, and `description` |
| brand | string | No | Case-insensitive exact brand filter |
| sort | string | No | Sort field with optional `-` prefix for descending. Allowed: `name`, `created_at`, `updated_at`. Default: `-created_at` |

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
      "public_id": "prd_01K4X8Y9P4M4G8N6F9V2A1B3C",
      "slug": "wireless-noise-cancelling-headphones",
      "name": "Wireless Noise-Cancelling Headphones",
      "description": "Premium over-ear headphones with active noise cancellation and 40-hour battery life.",
      "brand": "SoundWave",
      "created_at": "2026-08-01T10:00:00Z",
      "updated_at": "2026-08-02T09:00:00Z"
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

The customer list item is the Product Object. There is no activation field; every listed product is customer-visible by definition.

### Response Headers

> None.

---

## Processing Flow

1. Client sends the request with optional query parameters.
2. API validates query parameters (`page`, `limit`, `sort`).
3. API builds a query filtered to non-deleted products that have at least one non-deleted variant with `status = ACTIVE`.
4. API applies the `search` and `brand` filters.
5. API applies sorting and pagination.
6. API returns **200 OK** with the product list and pagination metadata.

---

## Business Rules

- Only products with `deleted_at IS NULL` and at least one variant with `status = ACTIVE` and `deleted_at IS NULL` are returned.
- Soft-deleted products and variant-less products are never returned.
- `brand` filter is case-insensitive exact match.
- `search` matches substrings in `name`, `brand`, or `description` (case-insensitive).
- `sort` accepts only `name`, `created_at`, and `updated_at`; a `-` prefix reverses order.
- Pagination uses 1-based `page` and clamps `limit` to a maximum of 100.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid `page`, `limit`, or `sort` value |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Public endpoint; no session required.
- Apply a rate limit to mitigate catalog scraping.
- Responses never expose internal database IDs or internal fields such as `cost_price` or variant `status`.

---

## Notes

- The response uses the shared `{ success: true, data }` envelope with the standard `pagination` object.
- The customer list item intentionally omits lifecycle fields (`deleted_at`): all listed products are visible by definition.

---

## Get Product

Returns a single product with its active variants and images for the storefront.

## Endpoint

```http
GET /api/v1/products/{product_public_id}
```

---

## Authentication

| Requirement | Value |
|-------------|-------|
| Authentication | Not Required |

---

## Authorization

None. Public endpoint.

---

## Request Headers

> None.

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

> None.

---

## Successful Response

**200 OK**

### Response Body

```json
{
  "success": true,
  "data": {
    "public_id": "prd_01K4X8Y9P4M4G8N6F9V2A1B3C",
    "slug": "wireless-noise-cancelling-headphones",
    "name": "Wireless Noise-Cancelling Headphones",
    "description": "Premium over-ear headphones with active noise cancellation and 40-hour battery life.",
    "brand": "SoundWave",
    "created_at": "2026-08-01T10:00:00Z",
    "updated_at": "2026-08-02T09:00:00Z",
    "variants": [
      {
        "public_id": "var_01K4X8Y9P4M4G8N6F9V2A1B3C",
        "sku": "SW-HP-001-BLK-M",
        "color": "Black",
        "size": "M",
        "price": "129.99",
        "discount_percentage": "10.00",
        "final_price": "116.99",
        "weight": "0.25",
        "images": [
          {
            "public_id": "vimg_01K4X8Y9P4M4G8N6F9V2A1B3C",
            "image_url": "https://cdn.example.com/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/var_01K4X8Y9P4M4G8N6F9V2A1B3C/black-side.jpg",
            "alt_text": "Wireless headphones in black, side view",
            "display_order": 1
          }
        ]
      }
    ],
    "images": [
      {
        "public_id": "pimg_01K4X8Y9P4M4G8N6F9V2A1B3C",
        "image_url": "https://cdn.example.com/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/hero.jpg",
        "alt_text": "Wireless headphones in black",
        "display_order": 1,
        "is_primary": true
      }
    ]
  }
}
```

### Response Headers

> None.

---

## Processing Flow

1. Client sends the request with the product public ID.
2. API resolves the public ID to the internal product ID.
3. API loads the product with its active variants and images.
4. API applies customer-facing visibility rules (see Business Rules).
5. API returns **200 OK** with the Product Detail Object.

---

## Business Rules

- The product must be non-deleted and have at least one non-deleted variant with `status = ACTIVE`; otherwise **404 Not Found** is returned.
- Only variants with `status = ACTIVE` and `deleted_at IS NULL` are embedded.
- Product images are embedded ordered by `display_order` ascending; the image flagged `is_primary = true` is the primary image (the flag is enforced to be unique per product by the Product Images API).
- Each embedded variant includes its own images ordered by `display_order` ascending.
- `final_price` is computed as `price * (1 - discount_percentage / 100)`, rounded to 2 decimal places.
- Internal fields (`cost_price`, dimensions, variant `status`, `barcode`, soft-delete timestamps) are never exposed.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Malformed public ID |
| 404 Not Found | Product does not exist, is soft-deleted, or has no active variant |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Public endpoint; no session required.
- Apply a rate limit to mitigate catalog scraping.
- A single response body is used for "not found", "soft-deleted", and "no active variant" to avoid leaking product existence.

---

## Notes

- Internal database IDs are never exposed; `product_public_id` is the only product identifier used externally.
- Customer consumption of variants and images happens through this endpoint; dedicated customer endpoints for sub-resources are not provided.

---

# Admin Product Management

All admin endpoints require an authenticated session with the `admin` role.

## List Products (Admin)

Returns a paginated list of all products, including optionally soft-deleted ones.

## Endpoint

```http
GET /api/v1/admin/products
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

> None.

---

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | integer | No | Page number, 1-based. Default: `1` |
| limit | integer | No | Page size. Default: `20`, max: `100` |
| search | string | No | Case-insensitive substring match against `name`, `brand`, and `description` |
| brand | string | No | Case-insensitive exact brand filter |
| include_deleted | boolean | No | Whether to include soft-deleted products. Default: `false` |
| sort | string | No | Sort field with optional `-` prefix. Allowed: `name`, `created_at`, `updated_at`. Default: `-created_at` |

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
      "public_id": "prd_01K4X8Y9P4M4G8N6F9V2A1B3C",
      "slug": "wireless-noise-cancelling-headphones",
      "name": "Wireless Noise-Cancelling Headphones",
      "description": "Premium over-ear headphones with active noise cancellation and 40-hour battery life.",
      "brand": "SoundWave",
      "created_at": "2026-08-01T10:00:00Z",
      "updated_at": "2026-08-02T09:00:00Z"
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

1. Client sends the request with the session cookie.
2. API authenticates the session and authorizes the `admin` role.
3. API builds a query over products, applying `search`, `brand`, and `include_deleted` filters.
4. API applies sorting and pagination.
5. API returns **200 OK** with the product list and pagination metadata.

---

## Business Rules

- Soft-deleted products are excluded unless `include_deleted = true`.
- When `include_deleted = true`, deleted products appear in the list without a restore capability (see Notes).
- Filter, sort, and pagination semantics match the customer list endpoint.
- The admin list item is the Product Object; lifecycle state (`deleted_at`) is not exposed in the payload.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid query parameter value |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated user is not an admin |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Requires a valid authenticated session and the `admin` role.
- Administrative actions should be recorded in audit logs.
- Internal database IDs are never exposed.

---

## Notes

- Soft-deleted products are returned with their `deleted_at` timestamp omitted from the payload; deletion state is inferred from the `include_deleted` context. A dedicated restore endpoint is not part of this API.

---

## Create Product (Admin)

Creates a new product.

## Endpoint

```http
POST /api/v1/admin/products
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

> None.

---

## Query Parameters

> None.

---

## Request Body

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| slug | string | No | 1–255 characters, matches `^[a-z0-9]+(?:-[a-z0-9]+)*$`; auto-generated from `name` when omitted |
| name | string | Yes | 1–255 characters |
| description | string | No | Max 10000 characters |
| brand | string | No | Max 255 characters |

### Example

```json
{
  "slug": "wireless-noise-cancelling-headphones",
  "name": "Wireless Noise-Cancelling Headphones",
  "description": "Premium over-ear headphones with active noise cancellation and 40-hour battery life.",
  "brand": "SoundWave"
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
    "public_id": "prd_01K4X8Y9P4M4G8N6F9V2A1B3C",
    "slug": "wireless-noise-cancelling-headphones",
    "name": "Wireless Noise-Cancelling Headphones",
    "description": "Premium over-ear headphones with active noise cancellation and 40-hour battery life.",
    "brand": "SoundWave",
    "created_at": "2026-08-03T10:00:00Z",
    "updated_at": "2026-08-03T10:00:00Z"
  }
}
```

### Response Headers

> None.

---

## Processing Flow

1. Client sends the request with the session cookie and JSON body.
2. API authenticates the session and authorizes the `admin` role.
3. API validates the request body.
4. API generates a slug from `name` when `slug` is omitted, or verifies uniqueness of the provided slug.
5. API generates a public ID and creates the product record.
6. API returns **201 Created** with the Product Object.

---

## Business Rules

- `name` is required; `slug` is optional and derived from `name` when omitted.
- Slug auto-generation: lowercase, spaces and runs of non-alphanumeric characters replaced by single hyphens, leading/trailing hyphens stripped. If the generated slug conflicts, a numeric suffix is appended (e.g., `-2`, `-3`).
- A provided `slug` that already exists returns **409 Conflict** (`PRODUCT_SLUG_TAKEN`).
- A product may be created without variants; it only becomes customer-visible once it has at least one active variant.
- Slug and name changes on existing products follow the same uniqueness rules via the update endpoint.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid request body or malformed slug |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated user is not an admin |
| 409 Conflict | Slug already exists |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Requires a valid authenticated session and the `admin` role.
- All input is validated before persistence; slugs are restricted to a safe character set to prevent path manipulation.
- Administrative actions should be recorded in audit logs.

---

## Notes

- Creation of variants and images is handled by their dedicated sub-resource endpoints after the product exists.
- Category assignment is out of scope for this API design.

---

## Get Product (Admin)

Returns a single product with all of its variants and images, including soft-deleted variants when requested.

## Endpoint

```http
GET /api/v1/admin/products/{product_public_id}
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
| include_deleted_variants | boolean | No | Whether to include soft-deleted variants. Default: `false` |

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
    "public_id": "prd_01K4X8Y9P4M4G8N6F9V2A1B3C",
    "slug": "wireless-noise-cancelling-headphones",
    "name": "Wireless Noise-Cancelling Headphones",
    "description": "Premium over-ear headphones with active noise cancellation and 40-hour battery life.",
    "brand": "SoundWave",
    "created_at": "2026-08-01T10:00:00Z",
    "updated_at": "2026-08-02T09:00:00Z",
    "variants": [
      {
        "public_id": "var_01K4X8Y9P4M4G8N6F9V2A1B3C",
        "product_public_id": "prd_01K4X8Y9P4M4G8N6F9V2A1B3C",
        "sku": "SW-HP-001-BLK-M",
        "barcode": "4006381333931",
        "color": "Black",
        "size": "M",
        "price": "129.99",
        "cost_price": "85.00",
        "discount_percentage": "10.00",
        "weight": "0.25",
        "length": "18.00",
        "width": "16.00",
        "height": "8.00",
        "status": "ACTIVE",
        "images": [
          {
            "public_id": "vimg_01K4X8Y9P4M4G8N6F9V2A1B3C",
            "product_variant_public_id": "var_01K4X8Y9P4M4G8N6F9V2A1B3C",
            "image_url": "https://cdn.example.com/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/var_01K4X8Y9P4M4G8N6F9V2A1B3C/black-side.jpg",
            "alt_text": "Wireless headphones in black, side view",
            "display_order": 1
          }
        ],
        "created_at": "2026-08-01T10:30:00Z",
        "updated_at": "2026-08-01T10:30:00Z"
      }
    ],
    "images": [
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
    ]
  }
}
```

### Response Headers

> None.

---

## Processing Flow

1. Client sends the request with the session cookie and product public ID.
2. API authenticates the session and authorizes the `admin` role.
3. API resolves the public ID to the internal product ID.
4. API loads the product with its variants (including variant images) and product images.
5. API returns **200 OK** with the full admin Product Detail Object.

---

## Business Rules

- The product must exist and not be soft-deleted; otherwise **404 Not Found** is returned.
- Variants are embedded with the full admin variant shape, including `cost_price`, dimensions, `barcode`, and `status`.
- Soft-deleted variants are excluded unless `include_deleted_variants = true`.
- Product images and variant images are ordered by `display_order` ascending.
- The admin detail embeds all variant statuses (`ACTIVE`, `DRAFT`, `INACTIVE`, `ARCHIVED`), unlike the customer detail which embeds only `ACTIVE` variants.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Malformed public ID |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated user is not an admin |
| 404 Not Found | Product does not exist or is soft-deleted |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Requires a valid authenticated session and the `admin` role.
- Internal pricing data (`cost_price`) is only exposed through admin endpoints.

---

## Notes

- The admin detail object is the superset of the customer detail object; customer payloads are a projection of this shape.
- Variant images carry no timestamps in the current schema (`product_variant_images` has no `created_at`/`updated_at` columns); product images do.

---

## Update Product (Admin)

Updates editable fields of a product. Partial update semantics: only the provided fields are changed.

## Endpoint

```http
PATCH /api/v1/admin/products/{product_public_id}
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

All fields are optional and follow the same validation rules as Create Product.

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| slug | string | No | 1–255 characters, matches `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| name | string | No | 1–255 characters |
| description | string | No | Max 10000 characters; `null` clears the value |
| brand | string | No | Max 255 characters; `null` clears the value |

### Example

```json
{
  "name": "Wireless Noise-Cancelling Headphones Pro",
  "brand": "SoundWave Pro"
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
    "public_id": "prd_01K4X8Y9P4M4G8N6F9V2A1B3C",
    "slug": "wireless-noise-cancelling-headphones",
    "name": "Wireless Noise-Cancelling Headphones Pro",
    "description": "Premium over-ear headphones with active noise cancellation and 40-hour battery life.",
    "brand": "SoundWave Pro",
    "created_at": "2026-08-01T10:00:00Z",
    "updated_at": "2026-08-04T14:30:00Z"
  }
}
```

### Response Headers

> None.

---

## Processing Flow

1. Client sends the request with the session cookie, product public ID, and JSON body.
2. API authenticates the session and authorizes the `admin` role.
3. API validates the request body.
4. API resolves the public ID to the internal product ID and verifies the product exists and is not soft-deleted.
5. API verifies slug uniqueness if `slug` is provided.
6. API updates only the provided fields and refreshes `updated_at`.
7. API returns **200 OK** with the updated Product Object.

---

## Business Rules

- A soft-deleted product cannot be updated (**404 Not Found**).
- Product visibility is derived (non-deleted + at least one `ACTIVE` variant); it cannot be toggled directly through this endpoint.
- Setting `slug` to an existing value returns **409 Conflict** (`PRODUCT_SLUG_TAKEN`).
- `description` and `brand` accept `null` to clear their values.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid request body |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated user is not an admin |
| 404 Not Found | Product does not exist or is soft-deleted |
| 409 Conflict | Slug already exists |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Requires a valid authenticated session and the `admin` role.
- All input is validated before persistence.

---

## Notes

- Variant-level changes are performed through the Product Variants API.

---

## Delete Product (Admin)

Soft-deletes a product and, in the same transaction, soft-deletes all of its variants. The records are retained in the database with a `deleted_at` timestamp and are excluded from all subsequent reads.

Soft deletion (rather than hard deletion) preserves referential integrity with historical business records such as `order_items`, which reference variants.

## Endpoint

```http
DELETE /api/v1/admin/products/{product_public_id}
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

1. Client sends the request with the session cookie and product public ID.
2. API authenticates the session and authorizes the `admin` role.
3. API resolves the public ID to the internal product ID and verifies the product exists and is not already soft-deleted.
4. API opens a database transaction.
5. API sets `deleted_at` on the product and on all of its non-deleted variants.
6. API commits the transaction.
7. API returns **204 No Content**.

---

## Business Rules

- Deleting an already soft-deleted product returns **404 Not Found**.
- Product deletion cascades a soft delete to all of its variants within the same transaction; variant images and product images are retained in storage but become unreachable because their parents are hidden.
- Historical order items are unaffected: they store immutable snapshots and reference variants that are only soft-deleted.
- There is no restore endpoint; deleted products are only visible through the admin list with `include_deleted = true`.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Malformed public ID |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated user is not an admin |
| 404 Not Found | Product does not exist or is already soft-deleted |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Requires a valid authenticated session and the `admin` role.
- The cascading soft delete must run inside a transaction to guarantee that a product and its variants are never left in a partially deleted state.
- Administrative actions should be recorded in audit logs.

---

## Notes

- The database schema documents `ON DELETE CASCADE` for product → images and product → variants; the soft-delete semantics defined here supersede hard cascading for the API surface, and `products.deleted_at` exists in the current schema.

---

# Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid request body or query parameters |
| 401 Unauthorized | Authentication required |
| 403 Forbidden | Insufficient permissions (non-admin) |
| 404 Not Found | Resource not found |
| 409 Conflict | Unique constraint violation (slug) |
| 500 Internal Server Error | Unexpected server error |

Error responses use the shared format:

```json
{
  "error": {
    "code": "PRODUCT_SLUG_TAKEN",
    "message": "A product with this slug already exists."
  }
}
```

---

# Notes

- Internal database IDs are never exposed; public IDs identify all resources externally.
- All amounts are returned as strings to preserve decimal precision.
- Timestamps are ISO 8601 UTC.
- Customer catalog endpoints are public; admin endpoints require an authenticated session with the `admin` role.

---

# Design Decisions

- **Two API surfaces** — The customer catalog is a minimal, public, read-only surface (`GET /products`, `GET /products/{id}`), while full CRUD lives under `/api/v1/admin/products`. This matches the project's rule of separating customer endpoints from administrator endpoints and keeps the storefront payloads lean.
- **Embedded sub-resources in detail** — Product detail embeds variants and images so a storefront renders a product page with one request. Standalone customer sub-resource endpoints are intentionally omitted.
- **Visibility rule (no activation flag)** — The `products` table has no `is_active` column; a product is customer-visible only when it is non-deleted (`deleted_at IS NULL`) and has at least one non-deleted variant with `status = ACTIVE`. This prevents selling products with no purchasable variant.
- **Primary image via `is_primary`** — The primary product image is flagged by the `product_images.is_primary` column (service-enforced, exactly one per product) instead of deriving it from `display_order`. The flag is exposed to customers so the storefront can render the hero image directly.
- **Barcode is admin-only** — The customer-facing variant shape excludes `barcode`; it is a point-of-sale/inventory identifier exposed only through admin endpoints.
- **Soft delete with transactional cascade** — `DELETE /admin/products/{id}` soft-deletes the product and all variants in one transaction. Images are retained but hidden. This aligns with the documented Soft Delete Policy and preserves order-item integrity.
- **Slug handling** — Slugs are optional on create and auto-generated from the name with a uniqueness suffix; explicit duplicate slugs return 409. Slug syntax is restricted to lowercase alphanumerics and hyphens.
- **Response envelope** — All responses use the shared `{ success: true, data }` wrapper with the standard `pagination` object on list endpoints, consistent with the implemented `ApiResponse` / `PaginatedResponse` types.
- **Public ID prefixes** — New prefixes are introduced: `prd` (product), `var` (product variant), `pimg` (product image), `vimg` (product variant image).
