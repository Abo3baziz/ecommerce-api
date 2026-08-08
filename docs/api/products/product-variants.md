# Product Variants API

## Overview

The Product Variants API manages the purchasable variations of a product. Each variant represents a unique combination of options (such as size or color) and owns its own SKU, barcode, pricing, cost, dimensions, status, and images.

Variants are managed exclusively by administrators through endpoints nested under their parent product. Customers consume variants embedded in the product detail response of the Products API and never manage them directly.

Inventory is a separate resource and is documented elsewhere; it is not part of this API.

---

# Variant Object

```json
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
  "created_at": "2026-08-01T10:30:00Z",
  "updated_at": "2026-08-01T10:30:00Z"
}
```

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| public_id | string | No | Public variant identifier (`var_…` prefix) |
| product_public_id | string | No | Public identifier of the parent product |
| sku | string | No | Stock Keeping Unit, unique across all variants (max 80 characters) |
| barcode | string | Yes | Barcode value of the variant (e.g., EAN-13) |
| color | string | Yes | Variant color (max 50 characters) |
| size | string | Yes | Variant size (max 50 characters) |
| price | string | No | Selling price (decimal, 2 places) |
| cost_price | string | Yes | Internal cost (decimal, 2 places) |
| discount_percentage | string | Yes | Discount percentage, 0–100 (decimal, 2 places) |
| weight | string | Yes | Weight in kg (decimal, 2 places) |
| length | string | Yes | Length in cm (decimal, 2 places) |
| width | string | Yes | Width in cm (decimal, 2 places) |
| height | string | Yes | Height in cm (decimal, 2 places) |
| status | string | Yes | `ACTIVE`, `DRAFT`, `INACTIVE`, or `ARCHIVED`. When `null`, the variant is not customer-visible (treated like a non-`ACTIVE` status) |
| created_at | string | No | Creation timestamp (ISO 8601) |
| updated_at | string | No | Last modification timestamp (ISO 8601) |

## Variant Status

| Status | Meaning |
| --- | --- |
| ACTIVE | Available for purchase; the only status visible to customers |
| DRAFT | In progress, not published |
| INACTIVE | Temporarily not available for purchase |
| ARCHIVED | Retired; no longer purchasable |

> The `status` column is nullable in the schema; a `null` status is equivalent to a non-`ACTIVE` status for customer visibility. On create, the API defaults the status to `ACTIVE` when omitted.

---

# Admin Variant Management

All endpoints require an authenticated session with the `admin` role.

## List Variants

Returns a paginated list of the variants belonging to a product.

## Endpoint

```http
GET /api/v1/admin/products/{product_public_id}/variants
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
| status | string | No | Filter by variant status (`ACTIVE`, `DRAFT`, `INACTIVE`, `ARCHIVED`); omitted returns all statuses |
| include_deleted | boolean | No | Whether to include soft-deleted variants. Default: `false` |
| sort | string | No | Sort field with optional `-` prefix. Allowed: `sku`, `price`, `created_at`, `updated_at`. Default: `created_at` |

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
      "created_at": "2026-08-01T10:30:00Z",
      "updated_at": "2026-08-01T10:30:00Z"
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
4. API builds a query over the product's variants, applying `status` and `include_deleted` filters.
5. API applies sorting and pagination.
6. API returns **200 OK** with the variant list and pagination metadata.

---

## Business Rules

- The parent product must exist and not be soft-deleted; otherwise **404 Not Found** is returned.
- Soft-deleted variants are excluded unless `include_deleted = true`.
- `status` filter accepts exactly one of `ACTIVE`, `DRAFT`, `INACTIVE`, `ARCHIVED`.
- Sort accepts only `sku`, `price`, `created_at`, and `updated_at`.

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
- Internal pricing data (`cost_price`) is only exposed through admin endpoints.

---

## Notes

- Variant images are not embedded in list responses; use the Get Variant endpoint to retrieve a variant with its images.

---

## Create Variant

Creates a new variant for a product.

## Endpoint

```http
POST /api/v1/admin/products/{product_public_id}/variants
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
| sku | string | Yes | 1–80 characters, unique across all variants |
| barcode | string | No | Max 255 characters |
| color | string | No | Max 50 characters |
| size | string | No | Max 50 characters |
| price | string | Yes | Decimal ≥ 0, max 10 integer + 2 decimal digits |
| cost_price | string | No | Decimal ≥ 0, max 10 integer + 2 decimal digits |
| discount_percentage | string | No | Decimal 0–100, max 3 integer + 2 decimal digits. Default: `"0.00"` |
| weight | string | No | Decimal > 0, max 8 integer + 2 decimal digits |
| length | string | No | Decimal > 0, max 8 integer + 2 decimal digits |
| width | string | No | Decimal > 0, max 8 integer + 2 decimal digits |
| height | string | No | Decimal > 0, max 8 integer + 2 decimal digits |
| status | string | No | `ACTIVE`, `DRAFT`, `INACTIVE`, or `ARCHIVED`. Default: `ACTIVE` |

### Example

```json
{
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
  "status": "ACTIVE"
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
3. API validates the request body (types, ranges, enum).
4. API resolves the public ID to the internal product ID and verifies the product exists and is not soft-deleted.
5. API verifies SKU uniqueness.
6. API generates a public ID and creates the variant record.
7. API returns **201 Created** with the Variant Object.

---

## Business Rules

- `sku` is required and unique across all variants (product-scoped duplicates and global duplicates both return **409 Conflict**, `VARIANT_SKU_TAKEN`).
- `price` is required and must be ≥ 0; `cost_price` must be ≥ 0.
- `discount_percentage` must be between 0 and 100 inclusive.
- `weight`, `length`, `width`, and `height` must be positive when provided.
- The parent product must not be soft-deleted.
- Creating a variant does not change the parent product; customer visibility is governed by the product visibility rule (product non-deleted + at least one `ACTIVE` variant).

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid request body |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated user is not an admin |
| 404 Not Found | Parent product does not exist or is soft-deleted |
| 409 Conflict | SKU already exists |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Requires a valid authenticated session and the `admin` role.
- Amounts are validated as decimal strings with bounded precision to prevent numeric injection.

---

## Notes

- Variant images are added through the Product Variant Images API after the variant exists.
- Inventory is managed by the Inventory API and is not created automatically by this endpoint.

---

## Get Variant

Returns a single variant with its images.

## Endpoint

```http
GET /api/v1/admin/products/{product_public_id}/variants/{variant_public_id}
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
}
```

### Response Headers

> None.

---

## Processing Flow

1. Client sends the request with the session cookie and both public IDs.
2. API authenticates the session and authorizes the `admin` role.
3. API resolves the product public ID and verifies the product exists and is not soft-deleted.
4. API resolves the variant public ID and verifies the variant belongs to the product and is not soft-deleted.
5. API loads the variant with its images ordered by `display_order`.
6. API returns **200 OK** with the Variant Object.

---

## Business Rules

- The variant must belong to the parent product identified in the path; otherwise **404 Not Found**.
- A soft-deleted variant returns **404 Not Found**.
- Images are embedded ordered by `display_order` ascending.
- Variant images carry no timestamps in the schema (`product_variant_images` has no `created_at`/`updated_at` columns).

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Malformed public ID |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated user is not an admin |
| 404 Not Found | Product or variant does not exist, is soft-deleted, or the variant does not belong to the product |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Requires a valid authenticated session and the `admin` role.
- The membership check between variant and product prevents cross-product access.

---

## Notes

- The variant is always addressed through its parent product path to keep the resource hierarchy explicit.

---

## Update Variant

Updates editable fields of a variant. Partial update semantics: only the provided fields are changed.

## Endpoint

```http
PATCH /api/v1/admin/products/{product_public_id}/variants/{variant_public_id}
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

All fields are optional and follow the same validation rules as Create Variant.

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| sku | string | No | 1–80 characters, unique |
| barcode | string | No | Max 255 characters; `null` clears the value |
| color | string | No | Max 50 characters; `null` clears the value |
| size | string | No | Max 50 characters; `null` clears the value |
| price | string | No | Decimal ≥ 0 |
| cost_price | string | No | Decimal ≥ 0; `null` clears the value |
| discount_percentage | string | No | Decimal 0–100 |
| weight | string | No | Decimal > 0; `null` clears the value |
| length | string | No | Decimal > 0; `null` clears the value |
| width | string | No | Decimal > 0; `null` clears the value |
| height | string | No | Decimal > 0; `null` clears the value |
| status | string | No | `ACTIVE`, `DRAFT`, `INACTIVE`, or `ARCHIVED`; `null` clears the value (variant becomes non-purchasable) |

### Example

```json
{
  "price": "119.99",
  "discount_percentage": "15.00",
  "status": "ACTIVE"
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
    "public_id": "var_01K4X8Y9P4M4G8N6F9V2A1B3C",
    "product_public_id": "prd_01K4X8Y9P4M4G8N6F9V2A1B3C",
    "sku": "SW-HP-001-BLK-M",
    "barcode": "4006381333931",
    "color": "Black",
    "size": "M",
    "price": "119.99",
    "cost_price": "85.00",
    "discount_percentage": "15.00",
    "weight": "0.25",
    "length": "18.00",
    "width": "16.00",
    "height": "8.00",
    "status": "ACTIVE",
    "created_at": "2026-08-01T10:30:00Z",
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
4. API resolves the product and variant, verifying existence, membership, and non-deletion.
5. API verifies SKU uniqueness if `sku` is provided.
6. API updates only the provided fields and refreshes `updated_at`.
7. API returns **200 OK** with the updated Variant Object.

---

## Business Rules

- A soft-deleted variant cannot be updated (**404 Not Found**).
- `product_public_id` is immutable; reassigning a variant to another product requires deleting and recreating it.
- Setting `sku` to an existing value returns **409 Conflict** (`VARIANT_SKU_TAKEN`).
- `barcode`, `color`, `size`, `cost_price`, `weight`, `length`, `width`, `height`, and `status` accept `null` to clear their values.
- Changing `status` away from `ACTIVE` immediately removes the variant from the customer catalog; changing it to `ACTIVE` makes it visible again (subject to the product visibility rule).

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid request body |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated user is not an admin |
| 404 Not Found | Product or variant does not exist, is soft-deleted, or the variant does not belong to the product |
| 409 Conflict | SKU already exists |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Requires a valid authenticated session and the `admin` role.
- Price and discount changes take effect immediately; the customer-facing `final_price` is computed from the updated values.

---

## Notes

- Inventory and images are managed through their dedicated APIs.

---

## Delete Variant

Soft-deletes a variant. The record is retained in the database with a `deleted_at` timestamp and is excluded from all subsequent reads.

Soft deletion preserves the variant's references from historical business records such as `order_items` and `cart_items`.

## Endpoint

```http
DELETE /api/v1/admin/products/{product_public_id}/variants/{variant_public_id}
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
3. API resolves the product and variant, verifying existence, membership, and non-deletion.
4. API sets `deleted_at` on the variant.
5. API returns **204 No Content**.

---

## Business Rules

- Deleting an already soft-deleted variant returns **404 Not Found**.
- Deleting the last active variant of a product makes the product invisible to customers until another active variant exists; the product record itself is not modified.
- Variant images are retained in storage but become unreachable because their parent is hidden.
- Historical order items and cart items are unaffected (they reference the variant by internal ID and store their own snapshots).

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Malformed public ID |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated user is not an admin |
| 404 Not Found | Product or variant does not exist, is soft-deleted, or the variant does not belong to the product |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Requires a valid authenticated session and the `admin` role.
- Deleting a variant must not break the inventory linkage; the Inventory API governs stock records for soft-deleted variants.

---

## Notes

- A soft-deleted variant remains visible to administrators through the variant list with `include_deleted = true` and through the admin product detail with `include_deleted_variants = true`.

---

# Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid request body or query parameters |
| 401 Unauthorized | Authentication required |
| 403 Forbidden | Insufficient permissions (non-admin) |
| 404 Not Found | Resource not found |
| 409 Conflict | Unique constraint violation (SKU) |
| 500 Internal Server Error | Unexpected server error |

Error responses use the shared format:

```json
{
  "error": {
    "code": "VARIANT_SKU_TAKEN",
    "message": "A variant with this SKU already exists."
  }
}
```

---

# Notes

- Internal database IDs are never exposed; public IDs identify all resources externally.
- All monetary and measurement amounts are returned as strings to preserve decimal precision.
- Timestamps are ISO 8601 UTC.
- Variants are always addressed through their parent product path.

---

# Design Decisions

- **Admin-only resource** — Customers never manage variants directly; they consume a projected variant shape embedded in the product detail. This keeps the storefront API surface minimal and hides internal pricing (`cost_price`), lifecycle fields (`status`, soft-delete timestamps), and `barcode`.
- **Nested under the parent product** — Variants are addressed as `/admin/products/{product_public_id}/variants/{variant_public_id}`. The parent is verified on every request so a variant can never be read or mutated through the wrong product.
- **Soft delete** — `deleted_at`-based deletion preserves the variant's references from `order_items` and `cart_items` and matches the documented Soft Delete Policy.
- **SKU uniqueness** — SKU is globally unique, not merely product-scoped, so a SKU can never be ambiguous across the catalog; duplicates return 409. The column is `VARCHAR(80)`.
- **Nullable status** — The `product_status` column is nullable; the API treats `null` as non-purchasable and defaults new variants to `ACTIVE`.
- **Decimal strings** — `price`, `cost_price`, `discount_percentage`, and dimensions are returned and accepted as strings to avoid floating-point precision loss and to keep the contract traceable to the `DECIMAL(10,2)` / `DECIMAL(5,2)` columns in the schema.
- **Response envelope** — All responses use the shared `{ success: true, data }` wrapper with the standard `pagination` object on list endpoints.
