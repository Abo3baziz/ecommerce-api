# Categories API

## Overview

The Categories API manages the category taxonomy of the product catalog. A category is a flat, non-hierarchical grouping used to organize products; products are linked to categories through the `product_categories` join table.

The API is split into two surfaces:

- **Customer catalog** — public, read-only endpoints used by the storefront to browse categories and the products within them.
- **Admin management** — protected endpoints used by administrators to create, update, list, delete categories, and to manage product-to-category assignments.

The `categories` table carries an explicit `is_active` flag (unlike `products`), so customer visibility is governed by `is_active = true` AND `deleted_at IS NULL`.

Authentication and session management are handled by the Authentication API. Product payloads embedded by this API follow the Product Catalog API (`docs/api/products/products.md`).

---

# Category Object

```json
{
  "public_id": "cat_01K4X8Y9P4M4G8N6F9V2A1B3C",
  "name": "Headphones",
  "slug": "headphones",
  "description": "Wired and wireless headphones, earbuds, and headsets.",
  "is_active": true,
  "created_at": "2026-08-01T10:00:00Z",
  "updated_at": "2026-08-01T10:00:00Z"
}
```

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| public_id | string | No | Public category identifier (`cat_…` prefix) |
| name | string | No | Category name (unique) |
| slug | string | No | SEO-friendly unique URL slug |
| description | string | Yes | Optional category description |
| is_active | boolean | No | Whether the category is customer-visible |
| created_at | string | No | Creation timestamp (ISO 8601) |
| updated_at | string | No | Last modification timestamp (ISO 8601) |

Two projections are used:

- **Customer Category Object** — omits `is_active` (every customer-visible category is active by definition) and never exposes `deleted_at`.
- **Admin Category Object** — includes `is_active`; `deleted_at` is never exposed in any payload.

## Category Detail Objects

The customer detail embeds a `product_count` (customer-visible products). The admin detail embeds `product_count` (non-deleted linked products).

---

# Customer Catalog

All customer endpoints are public.

# List Categories

## Overview

Returns a paginated list of customer-visible categories (active and non-deleted).

---

## Endpoint

```http
GET /api/v1/categories
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
| search | string | No | Case-insensitive substring match against `name` and `slug` |
| sort | string | No | Sort field with optional `-` prefix for descending. Allowed: `name`, `created_at`, `updated_at`. Default: `name` (ascending) |

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
      "public_id": "cat_01K4X8Y9P4M4G8N6F9V2A1B3C",
      "name": "Headphones",
      "slug": "headphones",
      "description": "Wired and wireless headphones, earbuds, and headsets.",
      "created_at": "2026-08-01T10:00:00Z",
      "updated_at": "2026-08-01T10:00:00Z"
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

The list item is the Customer Category Object. There is no activation field; every listed category is customer-visible by definition.

### Response Headers

> None.

---

## Processing Flow

1. Client sends the request with optional query parameters.
2. API validates query parameters (`page`, `limit`, `sort`).
3. API builds a query filtered to categories with `is_active = true` and `deleted_at IS NULL`.
4. API applies the `search` filter against `name` and `slug`.
5. API applies sorting and pagination.
6. API returns **200 OK** with the category list and pagination metadata.

---

## Business Rules

- Only categories with `is_active = true` and `deleted_at IS NULL` are returned.
- `search` matches substrings in `name` or `slug` (case-insensitive).
- `sort` accepts only `name`, `created_at`, and `updated_at`; a `-` prefix reverses order.
- Pagination uses 1-based `page` and clamps `limit` to a maximum of 100.
- The response uses the shared `{ success: true, data }` envelope with the standard `pagination` object.

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
- Responses never expose internal database IDs or lifecycle fields (`deleted_at`).

---

## Notes

- The Customer Category Object omits `is_active` because all listed categories are active by definition.

---

# Get Category

## Overview

Returns a single customer-visible category with the count of its customer-visible products.

---

## Endpoint

```http
GET /api/v1/categories/{category_public_id}
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
| category_public_id | string | Yes | Public category identifier (`cat_…`) |

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
    "public_id": "cat_01K4X8Y9P4M4G8N6F9V2A1B3C",
    "name": "Headphones",
    "slug": "headphones",
    "description": "Wired and wireless headphones, earbuds, and headsets.",
    "created_at": "2026-08-01T10:00:00Z",
    "updated_at": "2026-08-02T09:00:00Z",
    "product_count": 12
  }
}
```

### Response Headers

> None.

---

## Processing Flow

1. Client sends the request with the category public ID.
2. API resolves the public ID to the internal category ID.
3. API loads the category and verifies it is customer-visible (`is_active = true`, `deleted_at IS NULL`).
4. API counts the category's customer-visible products (see Business Rules).
5. API returns **200 OK** with the Customer Category Object and `product_count`.

---

## Business Rules

- The category must have `is_active = true` and `deleted_at IS NULL`; otherwise **404 Not Found** is returned.
- `product_count` counts linked products that are customer-visible (product non-deleted and with at least one non-deleted variant with `status = ACTIVE`).
- A single response body is used for "not found", "inactive", and "soft-deleted" to avoid leaking category existence.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Malformed public ID |
| 404 Not Found | Category does not exist, is inactive, or is soft-deleted |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Public endpoint; no session required.
- Apply a rate limit to mitigate catalog scraping.

---

## Notes

- Products within the category are fetched through the dedicated List Category Products endpoint; they are not embedded here to keep the payload bounded.

---

# List Category Products

## Overview

Returns a paginated list of customer-visible products belonging to a category.

---

## Endpoint

```http
GET /api/v1/categories/{category_public_id}/products
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
| category_public_id | string | Yes | Public category identifier (`cat_…`) |

---

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | integer | No | Page number, 1-based. Default: `1` |
| limit | integer | No | Page size. Default: `20`, max: `100` |
| search | string | No | Case-insensitive substring match against `name`, `brand`, and `description` |
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
    "total": 12,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

The list item is the Product Object as defined by the Product Catalog API.

### Response Headers

> None.

---

## Processing Flow

1. Client sends the request with the category public ID and optional query parameters.
2. API resolves the public ID and verifies the category is customer-visible.
3. API queries `product_categories` for linked products.
4. API applies customer-facing product visibility rules (non-deleted product with at least one non-deleted `ACTIVE` variant).
5. API applies `search`, sorting, and pagination.
6. API returns **200 OK** with the product list and pagination metadata.

---

## Business Rules

- The category must have `is_active = true` and `deleted_at IS NULL`; otherwise **404 Not Found** is returned.
- Only customer-visible products are returned (product `deleted_at IS NULL` and at least one variant with `status = ACTIVE` and `deleted_at IS NULL`).
- Filtering, sorting, and pagination semantics match `GET /api/v1/products`.
- Products linked to a soft-deleted category are never returned through this endpoint.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Malformed public ID or invalid query parameter value |
| 404 Not Found | Category does not exist, is inactive, or is soft-deleted |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Public endpoint; no session required.
- Apply a rate limit to mitigate catalog scraping.

---

## Notes

- This endpoint keeps category browsing self-contained; the Product Catalog API is not modified.
- A `category` filter on `GET /api/v1/products` may be added later as a cross-catalog convenience; it is out of scope for this API design.

---

# Admin Category Management

All admin endpoints require an authenticated session with the `admin` role.

# List Categories (Admin)

## Overview

Returns a paginated list of all categories, including inactive and optionally soft-deleted ones.

---

## Endpoint

```http
GET /api/v1/admin/categories
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
| search | string | No | Case-insensitive substring match against `name` and `slug` |
| is_active | boolean | No | Filter by activation state. Omitted: all states |
| include_deleted | boolean | No | Whether to include soft-deleted categories. Default: `false` |
| sort | string | No | Sort field with optional `-` prefix. Allowed: `name`, `created_at`, `updated_at`. Default: `name` (ascending) |

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
      "public_id": "cat_01K4X8Y9P4M4G8N6F9V2A1B3C",
      "name": "Headphones",
      "slug": "headphones",
      "description": "Wired and wireless headphones, earbuds, and headsets.",
      "is_active": true,
      "created_at": "2026-08-01T10:00:00Z",
      "updated_at": "2026-08-01T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 3,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

The list item is the Admin Category Object.

### Response Headers

> None.

---

## Processing Flow

1. Client sends the request with the session cookie and optional query parameters.
2. API authenticates the session and authorizes the `admin` role.
3. API builds a query over categories, applying `search`, `is_active`, and `include_deleted` filters.
4. API applies sorting and pagination.
5. API returns **200 OK** with the category list and pagination metadata.

---

## Business Rules

- Soft-deleted categories are excluded unless `include_deleted = true`.
- `is_active` filters by activation state when provided; otherwise both states are returned.
- When `include_deleted = true`, deleted categories appear without a restore capability (see Notes).
- Filter, sort, and pagination semantics match the customer list endpoint.
- `deleted_at` is never exposed in the payload.

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

- A dedicated restore endpoint is not part of this API; deleted categories are only visible through the admin list with `include_deleted = true`.

---

# Create Category (Admin)

## Overview

Creates a new category.

---

## Endpoint

```http
POST /api/v1/admin/categories
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
| is_active | boolean | No | Default: `true` |

### Example

```json
{
  "name": "Headphones",
  "description": "Wired and wireless headphones, earbuds, and headsets.",
  "is_active": true
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
    "public_id": "cat_01K4X8Y9P4M4G8N6F9V2A1B3C",
    "name": "Headphones",
    "slug": "headphones",
    "description": "Wired and wireless headphones, earbuds, and headsets.",
    "is_active": true,
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
5. API verifies `name` uniqueness.
6. API generates a public ID (`cat_…`) and creates the category record.
7. API returns **201 Created** with the Admin Category Object.

---

## Business Rules

- `name` is required; `slug` is optional and derived from `name` when omitted.
- Slug auto-generation: lowercase, spaces and runs of non-alphanumeric characters replaced by single hyphens, leading/trailing hyphens stripped. If the generated slug conflicts, a numeric suffix is appended (e.g., `-2`, `-3`).
- A provided `slug` that already exists returns **409 Conflict** (`CATEGORY_SLUG_TAKEN`).
- A `name` that already exists returns **409 Conflict** (`CATEGORY_NAME_TAKEN`).
- A new category is inactive-capable only via `is_active: false`; the default is active.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid request body or malformed slug |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated user is not an admin |
| 409 Conflict | Slug or name already exists |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Requires a valid authenticated session and the `admin` role.
- All input is validated before persistence; slugs are restricted to a safe character set.
- Administrative actions should be recorded in audit logs.

---

## Notes

- Product assignment is performed through the Assign/Unassign endpoints after the category exists.

---

# Get Category (Admin)

## Overview

Returns a single category with the count of its non-deleted linked products.

---

## Endpoint

```http
GET /api/v1/admin/categories/{category_public_id}
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
| category_public_id | string | Yes | Public category identifier (`cat_…`) |

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
    "public_id": "cat_01K4X8Y9P4M4G8N6F9V2A1B3C",
    "name": "Headphones",
    "slug": "headphones",
    "description": "Wired and wireless headphones, earbuds, and headsets.",
    "is_active": true,
    "created_at": "2026-08-01T10:00:00Z",
    "updated_at": "2026-08-02T09:00:00Z",
    "product_count": 12
  }
}
```

### Response Headers

> None.

---

## Processing Flow

1. Client sends the request with the session cookie and category public ID.
2. API authenticates the session and authorizes the `admin` role.
3. API resolves the public ID to the internal category ID.
4. API loads the category and verifies it exists and is not soft-deleted.
5. API counts the category's non-deleted linked products.
6. API returns **200 OK** with the Admin Category Object and `product_count`.

---

## Business Rules

- The category must exist and not be soft-deleted; otherwise **404 Not Found** is returned.
- `product_count` counts linked products with `deleted_at IS NULL` regardless of activation state or variant availability.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Malformed public ID |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated user is not an admin |
| 404 Not Found | Category does not exist or is soft-deleted |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Requires a valid authenticated session and the `admin` role.

---

## Notes

- The admin detail is the superset of the customer detail; it adds `is_active` and uses the admin product-count semantics.

---

# Update Category (Admin)

## Overview

Updates editable fields of a category. Partial update semantics: only the provided fields are changed.

---

## Endpoint

```http
PATCH /api/v1/admin/categories/{category_public_id}
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
| category_public_id | string | Yes | Public category identifier (`cat_…`) |

---

## Query Parameters

> None.

---

## Request Body

All fields are optional and follow the same validation rules as Create Category.

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| slug | string | No | 1–255 characters, matches `^[a-z0-9]+(?:-[a-z0-9]+)*$` |
| name | string | No | 1–255 characters |
| description | string | No | Max 10000 characters; `null` clears the value |
| is_active | boolean | No | Toggles customer visibility |

### Example

```json
{
  "name": "Headphones & Earbuds",
  "is_active": true
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
    "public_id": "cat_01K4X8Y9P4M4G8N6F9V2A1B3C",
    "name": "Headphones & Earbuds",
    "slug": "headphones",
    "description": "Wired and wireless headphones, earbuds, and headsets.",
    "is_active": true,
    "created_at": "2026-08-01T10:00:00Z",
    "updated_at": "2026-08-04T14:30:00Z"
  }
}
```

### Response Headers

> None.

---

## Processing Flow

1. Client sends the request with the session cookie, category public ID, and JSON body.
2. API authenticates the session and authorizes the `admin` role.
3. API validates the request body.
4. API resolves the public ID to the internal category ID and verifies the category exists and is not soft-deleted.
5. API verifies `name` and `slug` uniqueness if either is provided.
6. API updates only the provided fields and refreshes `updated_at`.
7. API returns **200 OK** with the updated Admin Category Object.

---

## Business Rules

- A soft-deleted category cannot be updated (**404 Not Found**).
- Setting `name` or `slug` to an existing value returns **409 Conflict** (`CATEGORY_NAME_TAKEN` / `CATEGORY_SLUG_TAKEN`).
- Setting `is_active: false` hides the category from the customer surface immediately; existing assignments are retained.
- `description` accepts `null` to clear its value.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid request body |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated user is not an admin |
| 404 Not Found | Category does not exist or is soft-deleted |
| 409 Conflict | Name or slug already exists |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Requires a valid authenticated session and the `admin` role.
- All input is validated before persistence.

---

## Notes

- Product assignments are not affected by category updates.

---

# Delete Category (Admin)

## Overview

Soft-deletes a category and, in the same transaction, removes all of its product-to-category assignment links. The category record is retained with a `deleted_at` timestamp and is excluded from all subsequent reads.

Soft deletion (rather than hard deletion) preserves referential integrity with historical business records. Assignment links are catalog-only rows and are safely hard-removed.

---

## Endpoint

```http
DELETE /api/v1/admin/categories/{category_public_id}
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
| category_public_id | string | Yes | Public category identifier (`cat_…`) |

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

1. Client sends the request with the session cookie and category public ID.
2. API authenticates the session and authorizes the `admin` role.
3. API resolves the public ID to the internal category ID and verifies the category exists and is not already soft-deleted.
4. API opens a database transaction.
5. API sets `deleted_at` on the category.
6. API hard-deletes all `product_categories` rows referencing the category.
7. API commits the transaction.
8. API returns **204 No Content**.

---

## Business Rules

- Deleting an already soft-deleted category returns **404 Not Found**.
- Category deletion removes its assignment links within the same transaction so the category never appears on products after deletion.
- Products themselves are unaffected; only the category membership is removed.
- There is no restore endpoint; deleted categories are only visible through the admin list with `include_deleted = true`.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Malformed public ID |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated user is not an admin |
| 404 Not Found | Category does not exist or is already soft-deleted |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Requires a valid authenticated session and the `admin` role.
- The soft delete and link removal must run inside a transaction to guarantee an atomic state.
- Administrative actions should be recorded in audit logs.

---

## Notes

- Assignment links are catalog-only (not business records), so hard removal is safe; the category row itself is retained for historical reference.

---

# Assign Product to Category (Admin)

## Overview

Assigns a product to a category by creating a `product_categories` link. The operation is idempotent: assigning an already-assigned product is a no-op.

---

## Endpoint

```http
PUT /api/v1/admin/categories/{category_public_id}/products/{product_public_id}
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
| category_public_id | string | Yes | Public category identifier (`cat_…`) |
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

1. Client sends the request with the session cookie and both public IDs.
2. API authenticates the session and authorizes the `admin` role.
3. API resolves both public IDs to internal IDs and verifies the category and product exist and are not soft-deleted.
4. API creates the `product_categories` link if it does not already exist.
5. API returns **204 No Content**.

---

## Business Rules

- The category must exist and not be soft-deleted; otherwise **404 Not Found**.
- The product must exist and not be soft-deleted; otherwise **404 Not Found**.
- Assigning a product that is already linked is a no-op success (**204**).
- The unique constraint on `[categories_id, products_id]` guarantees a product is linked to a category at most once.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Malformed public ID |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated user is not an admin |
| 404 Not Found | Category or product does not exist or is soft-deleted |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Requires a valid authenticated session and the `admin` role.
- Administrative actions should be recorded in audit logs.

---

## Notes

- The operation is idempotent and safe to retry.

---

# Unassign Product from Category (Admin)

## Overview

Removes a product from a category by deleting the `product_categories` link. The operation is idempotent: removing a link that does not exist is a no-op.

---

## Endpoint

```http
DELETE /api/v1/admin/categories/{category_public_id}/products/{product_public_id}
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
| category_public_id | string | Yes | Public category identifier (`cat_…`) |
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

1. Client sends the request with the session cookie and both public IDs.
2. API authenticates the session and authorizes the `admin` role.
3. API resolves both public IDs to internal IDs and verifies the category and product exist and are not soft-deleted.
4. API deletes the `product_categories` link if it exists.
5. API returns **204 No Content**.

---

## Business Rules

- The category must exist and not be soft-deleted; otherwise **404 Not Found**.
- The product must exist and not be soft-deleted; otherwise **404 Not Found**.
- Removing a link that does not exist is a no-op success (**204**).

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Malformed public ID |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated user is not an admin |
| 404 Not Found | Category or product does not exist or is soft-deleted |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Requires a valid authenticated session and the `admin` role.
- Administrative actions should be recorded in audit logs.

---

## Notes

- The operation is idempotent and safe to retry.

---

# Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid request body or query parameters |
| 401 Unauthorized | Authentication required |
| 403 Forbidden | Insufficient permissions (non-admin) |
| 404 Not Found | Resource not found |
| 409 Conflict | Unique constraint violation (name or slug) |
| 500 Internal Server Error | Unexpected server error |

Error responses use the shared format:

```json
{
  "error": {
    "code": "CATEGORY_SLUG_TAKEN",
    "message": "A category with this slug already exists."
  }
}
```

Error codes specific to this API:

| Code | Scenario |
|------|----------|
| CATEGORY_NOT_FOUND | Category does not exist, is inactive, or is soft-deleted |
| CATEGORY_SLUG_TAKEN | Slug already exists |
| CATEGORY_NAME_TAKEN | Name already exists |
| PRODUCT_NOT_FOUND | Product does not exist or is soft-deleted |

---

# Notes

- Internal database IDs are never exposed; public IDs identify all resources externally. The `cat_…` prefix already exists in `PUBLIC_ID_PREFIXES`.
- Timestamps are ISO 8601 UTC.
- `deleted_at` is never exposed in any payload; deletion state is only inferred from `include_deleted` context.
- Customer catalog endpoints are public; admin endpoints require an authenticated session with the `admin` role.
- Categories are flat: the schema has no parent/child relationship, so no hierarchy traversal is supported.

---

# Design Decisions

- **Flat taxonomy** — The `categories` table has no self-relation (no `parent_id`), so the API exposes a flat list; hierarchical categories would require a schema change and are out of scope.
- **Explicit activation flag** — Unlike `products`, `categories` has an `is_active` column. Customer visibility is `is_active = true` AND `deleted_at IS NULL`, and `is_active` is toggled directly via the admin update endpoint.
- **Two API surfaces** — Customer endpoints are public and read-only (`GET /categories`, `GET /categories/{id}`, `GET /categories/{id}/products`); full CRUD plus assignment lives under `/api/v1/admin/categories`.
- **Dedicated products-in-category endpoint** — Category detail returns only `product_count`; the actual products are fetched through `GET /api/v1/categories/{id}/products`. This keeps the detail payload bounded and reuses the Product Object instead of embedding a heavy list. A `category` filter on `GET /api/v1/products` remains a possible future convenience, explicitly out of scope here.
- **Soft delete with transactional link removal** — `DELETE /admin/categories/{id}` sets `deleted_at` and hard-deletes the category's `product_categories` rows in one transaction. The category row is retained for historical reference; assignment links are catalog-only and safe to remove.
- **Idempotent assignment endpoints** — `PUT`/`DELETE /admin/categories/{id}/products/{productId}` are per-pair and idempotent (no-op success when already assigned / not assigned), guarded by the `[categories_id, products_id]` unique constraint.
- **Slug and name uniqueness** — Both `name` and `slug` are unique in the schema; conflicts return **409** with dedicated error codes. Slug auto-generation (with `-2`/`-3`… suffixing) matches the Product Catalog API.
- **Public ID prefix** — `cat` already exists in `PUBLIC_ID_PREFIXES`; no new prefix is introduced.
- **Response envelope** — All responses use the shared `{ success: true, data }` wrapper with the standard `pagination` object on list endpoints.
