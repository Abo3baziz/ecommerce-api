# Inventory API

## Overview

The Inventory API manages stock for product variants. Each inventory record tracks the total quantity on hand, the quantity reserved for pending orders, and an optional reorder level that signals when replenishment is recommended.

Inventory is a **1:1 child of a product variant**: every `inventory` row belongs to exactly one `product_variants` row (enforced by the unique `product_variants_id` constraint), and a variant owns at most one inventory record.

The API is **admin-only**. Customers never read stock through this API; the customer-facing product contract (see `docs/api/products/products.md`) derives purchasability from variant status only, and that contract is unchanged.

All stock changes are applied inside database transactions, and decreasing stock below zero is rejected, satisfying the documented requirements:

- Increase stock
- Decrease stock
- Prevent overselling
- Support transactional stock updates

Authentication and session management are handled by the Authentication API.

---

# Public Key

The `inventory` table has **no `public_id` column** (see `docs/DATABASE.md`). Because inventory is 1:1 with a variant, the **variant's public ID (`var_…`) is the stable public key** of an inventory record.

- Every inventory path uses `{variant_public_id}` in the URL.
- Internal inventory IDs are never exposed.
- No schema change is required to serve the API (see **Design Decisions**).

---

# Inventory Object

```json
{
  "public_id": "var_01J6XK8Q3M2N5B7V9C4D1E0F",
  "product_public_id": "prd_01J6XK8Q3M2N5B7V9C4D1E0F",
  "product_name": "Wireless Headphones",
  "sku": "WH-1000XM5-BLK",
  "barcode": "0272429250045",
  "quantity_on_hand": 100,
  "quantity_reserved": 5,
  "quantity_available": 95,
  "reorder_level": 20,
  "stock_status": "IN_STOCK",
  "created_at": "2026-08-01T10:00:00Z",
  "last_stock_update": "2026-08-05T14:30:00Z"
}
```

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| public_id | string | No | Public ID of the owning variant (`var_…`) — the stable public key of the inventory record |
| product_public_id | string | No | Public ID of the parent product (`prd_…`) |
| product_name | string | No | Name of the parent product |
| sku | string | No | Variant SKU (max 80 characters) |
| barcode | string | Yes | Variant barcode, when set |
| quantity_on_hand | integer | No | Total quantity currently in stock (≥ 0) |
| quantity_reserved | integer | No | Quantity reserved for pending orders (`COALESCE(quantity_reserved, 0)`) |
| quantity_available | integer | No | Derived: `quantity_on_hand - quantity_reserved` |
| reorder_level | integer | Yes | Stock threshold that indicates when replenishment is recommended |
| stock_status | string | No | Derived status: `IN_STOCK`, `LOW_STOCK`, or `OUT_OF_STOCK` |
| created_at | string | No | Creation timestamp (ISO 8601 UTC) |
| last_stock_update | string | No | Timestamp of the most recent stock update (ISO 8601 UTC) |

## Derived Fields

### quantity_available

```text
quantity_available = quantity_on_hand - COALESCE(quantity_reserved, 0)
```

Computed server-side; never stored. A negative value (reserved exceeding on-hand) is surfaced as-is for operational visibility — it indicates a data anomaly that operations must reconcile.

### stock_status

```text
OUT_OF_STOCK  when quantity_available <= 0
LOW_STOCK     when reorder_level IS NOT NULL AND quantity_available <= reorder_level
IN_STOCK      otherwise
```

Computed server-side; never stored.

## Projection

A single **Admin Inventory Object** is used for every endpoint. There is no customer projection — the inventory surface is admin-only, and `deleted_at` is never exposed.

---

# Admin Inventory Management

All endpoints require an authenticated session with the `admin` or `super_admin` role.

# List Inventory

## Overview

Returns a paginated list of inventory records for product variants, with search, stock-status filtering, and sorting. Intended for the admin inventory dashboard (stock levels, low-stock and out-of-stock views).

---

## Endpoint

```http
GET /api/v1/admin/inventory
```

---

## Authentication

| Requirement | Value |
|-------------|-------|
| Authentication | Required |

---

## Authorization

Authenticated user with role `ADMIN` or `SUPER_ADMIN`. Customers and unauthenticated requests are rejected with `401`/`403`.

---

## Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| Cookie | Yes | `session` cookie issued at login |

---

## Path Parameters

> None.

---

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | integer | No | Page number, 1-based. Default: `1` |
| limit | integer | No | Page size. Default: `20`, max: `100` |
| search | string | No | Case-insensitive substring match against variant `sku`, `barcode`, or product `name` |
| stock_status | string | No | Filter by derived status: `IN_STOCK`, `LOW_STOCK`, or `OUT_OF_STOCK` |
| include_deleted | boolean | No | Include inventory of soft-deleted variants. Default: `false` |
| sort | string | No | Sort field with optional `-` prefix for descending. Allowed: `product_name`, `sku`, `quantity_on_hand`, `quantity_available`, `last_stock_update`. Default: `product_name` (ascending) |

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
      "public_id": "var_01J6XK8Q3M2N5B7V9C4D1E0F",
      "product_public_id": "prd_01J6XK8Q3M2N5B7V9C4D1E0F",
      "product_name": "Wireless Headphones",
      "sku": "WH-1000XM5-BLK",
      "barcode": "0272429250045",
      "quantity_on_hand": 100,
      "quantity_reserved": 5,
      "quantity_available": 95,
      "reorder_level": 20,
      "stock_status": "IN_STOCK",
      "created_at": "2026-08-01T10:00:00Z",
      "last_stock_update": "2026-08-05T14:30:00Z"
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

1. Client sends the request with an authenticated session and optional query parameters.
2. API validates query parameters (`page`, `limit`, `search`, `stock_status`, `include_deleted`, `sort`).
3. API joins `inventory` to `product_variants` and `products`, and excludes soft-deleted variants unless `include_deleted=true`.
4. API applies the `search` filter against `sku`, `barcode`, and product `name`.
5. API applies the derived `stock_status` filter (computed from `quantity_available` and `reorder_level`).
6. API applies sorting and pagination.
7. API returns **200 OK** with the inventory list and pagination metadata.

---

## Business Rules

- Only variants with `deleted_at IS NULL` are included by default; `include_deleted=true` also returns inventory of soft-deleted variants (the Inventory API continues to govern those stock records).
- `search` matches substrings in `sku`, `barcode`, or product `name` (case-insensitive).
- `stock_status` is a derived filter computed server-side; it never reflects a stored column.
- `sort` accepts only `product_name`, `sku`, `quantity_on_hand`, `quantity_available`, and `last_stock_update`; a `-` prefix reverses order.
- Pagination uses 1-based `page` and clamps `limit` to a maximum of 100.
- The response uses the shared `{ success: true, data }` envelope with the standard `pagination` object.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid query parameters (e.g., unknown `sort` field, invalid `stock_status`) |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated user is not an `ADMIN` or `SUPER_ADMIN` |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Endpoint is behind `authentication` + `authorization(user_role.ADMIN, user_role.SUPER_ADMIN)` middleware.
- Internal inventory/variant/product IDs are never exposed.
- Query parameters are validated before reaching the service layer.

---

## Notes

- An inventory record only exists once stock has been created for a variant; variants without a record are absent from the list.
- `quantity_reserved` is never editable through this API; it is managed by the order flow.

---

# Create Inventory

## Overview

Creates the inventory record for a product variant with an initial on-hand quantity. Inventory is **not** created automatically by the Product Catalog API (see `docs/api/products/product-variants.md`); an admin creates it explicitly.

---

## Endpoint

```http
POST /api/v1/admin/inventory
```

---

## Authentication

| Requirement | Value |
|-------------|-------|
| Authentication | Required |

---

## Authorization

Authenticated user with role `ADMIN` or `SUPER_ADMIN`.

---

## Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| Cookie | Yes | `session` cookie issued at login |

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
| variant_public_id | string | Yes | Public ID of an existing non-deleted variant (`var_…` format) |
| quantity_on_hand | integer | Yes | Initial stock quantity, ≥ 0 |
| reorder_level | integer | No | Replenishment threshold, ≥ 0 |

### Example

```json
{
  "variant_public_id": "var_01J6XK8Q3M2N5B7V9C4D1E0F",
  "quantity_on_hand": 100,
  "reorder_level": 20
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
    "public_id": "var_01J6XK8Q3M2N5B7V9C4D1E0F",
    "product_public_id": "prd_01J6XK8Q3M2N5B7V9C4D1E0F",
    "product_name": "Wireless Headphones",
    "sku": "WH-1000XM5-BLK",
    "barcode": "0272429250045",
    "quantity_on_hand": 100,
    "quantity_reserved": 0,
    "quantity_available": 100,
    "reorder_level": 20,
    "stock_status": "IN_STOCK",
    "created_at": "2026-08-01T10:00:00Z",
    "last_stock_update": "2026-08-01T10:00:00Z"
  }
}
```

### Response Headers

> None.

---

## Processing Flow

1. Client sends the request with an authenticated session.
2. API validates the request body (`variant_public_id`, `quantity_on_hand`, `reorder_level`).
3. API resolves the variant by its public ID; a missing or soft-deleted variant returns **404**.
4. API checks that no inventory record exists for the variant; an existing record returns **409**.
5. API creates the inventory row inside a transaction with `created_at` and `last_stock_update` set to the current time.
6. API returns **201 Created** with the Inventory Object.

---

## Business Rules

- `variant_public_id` must reference a non-deleted variant; soft-deleted variants are treated as not found (**404**).
- A variant can own at most one inventory record (unique `product_variants_id`); a duplicate creation returns **409**.
- `quantity_on_hand` must be ≥ 0 (mirrors the `ck_inventory_quantity_non_negative` database check).
- Initial `quantity_reserved` is `0` (the column is nullable; the API presents it as `0`).
- `last_stock_update` equals `created_at` on creation.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid request body (e.g., negative `quantity_on_hand`, malformed `variant_public_id`) |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated user is not an `ADMIN` or `SUPER_ADMIN` |
| 404 Not Found | Variant does not exist or is soft-deleted |
| 409 Conflict | Inventory record already exists for the variant |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Endpoint is behind `authentication` + `authorization(user_role.ADMIN, user_role.SUPER_ADMIN)` middleware.
- `variant_public_id` is resolved to an internal ID inside the service; the public ID is the only variant identifier accepted.

---

## Notes

- There is no bulk-create endpoint; each variant receives its inventory record individually.

---

# Get Inventory

## Overview

Returns the inventory record for a single product variant.

---

## Endpoint

```http
GET /api/v1/admin/inventory/{variant_public_id}
```

---

## Authentication

| Requirement | Value |
|-------------|-------|
| Authentication | Required |

---

## Authorization

Authenticated user with role `ADMIN` or `SUPER_ADMIN`.

---

## Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| Cookie | Yes | `session` cookie issued at login |

---

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| variant_public_id | string | Yes | Public ID of the variant whose inventory is returned (`var_…`) |

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
    "public_id": "var_01J6XK8Q3M2N5B7V9C4D1E0F",
    "product_public_id": "prd_01J6XK8Q3M2N5B7V9C4D1E0F",
    "product_name": "Wireless Headphones",
    "sku": "WH-1000XM5-BLK",
    "barcode": "0272429250045",
    "quantity_on_hand": 100,
    "quantity_reserved": 5,
    "quantity_available": 95,
    "reorder_level": 20,
    "stock_status": "IN_STOCK",
    "created_at": "2026-08-01T10:00:00Z",
    "last_stock_update": "2026-08-05T14:30:00Z"
  }
}
```

### Response Headers

> None.

---

## Processing Flow

1. Client sends the request with an authenticated session.
2. API validates the `variant_public_id` path parameter.
3. API resolves the variant and its inventory record.
4. API returns **200 OK** with the Inventory Object, or **404** when the variant does not exist or has no inventory record.

---

## Business Rules

- A variant without an inventory record returns **404** (no implicit empty record).
- A soft-deleted variant returns **404** by default; inventory for soft-deleted variants is reachable through the list endpoint with `include_deleted=true`.
- Internal inventory IDs are never exposed; the object is keyed by the variant's public ID.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Malformed `variant_public_id` |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated user is not an `ADMIN` or `SUPER_ADMIN` |
| 404 Not Found | Variant does not exist, is soft-deleted, or has no inventory record |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Endpoint is behind `authentication` + `authorization(user_role.ADMIN, user_role.SUPER_ADMIN)` middleware.

---

## Notes

- This endpoint does not create inventory; use `POST /api/v1/admin/inventory` first.

---

# Update Inventory

## Overview

Adjusts the stock of a product variant: sets the absolute on-hand quantity, applies a delta (increase/decrease), and/or updates the reorder level. All quantity changes are applied atomically inside a transaction, and a change that would drive stock below zero is rejected — this is the overselling guard.

---

## Endpoint

```http
PATCH /api/v1/admin/inventory/{variant_public_id}
```

---

## Authentication

| Requirement | Value |
|-------------|-------|
| Authentication | Required |

---

## Authorization

Authenticated user with role `ADMIN` or `SUPER_ADMIN`.

---

## Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| Cookie | Yes | `session` cookie issued at login |

---

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| variant_public_id | string | Yes | Public ID of the variant whose inventory is updated (`var_…`) |

---

## Query Parameters

> None.

---

## Request Body

At least one field is required. `quantity_on_hand` and `quantity_change` are mutually exclusive.

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| quantity_on_hand | integer | No | Absolute stock quantity, ≥ 0. Mutually exclusive with `quantity_change` |
| quantity_change | integer | No | Signed delta to apply to the current on-hand quantity (increase = positive, decrease = negative). Non-zero. Mutually exclusive with `quantity_on_hand` |
| reorder_level | integer | No | Replenishment threshold, ≥ 0, or `null` to clear |
| reason | string | No | Optional free-text reason for the adjustment (max 255 characters). Audit-only; never persisted |

### Example

```json
{
  "quantity_change": -15,
  "reason": "Damaged units written off after stocktake"
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
    "public_id": "var_01J6XK8Q3M2N5B7V9C4D1E0F",
    "product_public_id": "prd_01J6XK8Q3M2N5B7V9C4D1E0F",
    "product_name": "Wireless Headphones",
    "sku": "WH-1000XM5-BLK",
    "barcode": "0272429250045",
    "quantity_on_hand": 85,
    "quantity_reserved": 5,
    "quantity_available": 80,
    "reorder_level": 20,
    "stock_status": "IN_STOCK",
    "created_at": "2026-08-01T10:00:00Z",
    "last_stock_update": "2026-08-06T09:15:00Z"
  }
}
```

### Response Headers

> None.

---

## Processing Flow

1. Client sends the request with an authenticated session.
2. API validates the path parameter and request body.
3. API resolves the inventory record for the variant; **404** when the variant or its inventory record does not exist.
4. API begins a transaction and locks the inventory row (row-level lock) so concurrent adjustments serialize.
5. API applies the changes:
   - `quantity_on_hand` replaces the stored value.
   - `quantity_change` increments the stored value; if the result would be negative, the transaction rolls back and **409** is returned.
6. API updates `last_stock_update` to the current time.
7. API commits the transaction and returns **200 OK** with the updated Inventory Object.

---

## Business Rules

- At least one of `quantity_on_hand`, `quantity_change`, or `reorder_level` is required; an empty body returns **400**.
- `quantity_on_hand` and `quantity_change` are mutually exclusive; sending both returns **400**.
- `quantity_change` must be non-zero; `0` returns **400**.
- Stock can never be decreased below zero: an absolute set is validated (≥ 0), and a delta that would overshoot zero is rejected with **409** (resource-state conflict). This satisfies the "prevent overselling" requirement for admin adjustments.
- `quantity_reserved` is **read-only** through this API; it is managed by the order flow and never accepted in the request body.
- `reorder_level` accepts `null` to clear the threshold.
- `last_stock_update` is refreshed on every successful write to the record.
- `reason` is audit-only: it is recorded via the structured logger (with actor, variant, previous/next quantity, and reason) and is not stored in the database.
- All changes occur inside a single `prisma.$transaction`; the response is only produced after commit.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid request body (empty, negative absolute quantity, `quantity_change: 0`, both quantity fields, over-long `reason`) |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated user is not an `ADMIN` or `SUPER_ADMIN` |
| 404 Not Found | Variant does not exist, is soft-deleted, or has no inventory record |
| 409 Conflict | `quantity_change` would drive `quantity_on_hand` below zero |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Endpoint is behind `authentication` + `authorization(user_role.ADMIN, user_role.SUPER_ADMIN)` middleware.
- Stock mutations are transactional and row-locked, preventing lost updates under concurrent admin adjustments.
- `reason` is length-limited and treated as untrusted input; it is only ever written to logs.

---

## Notes

- The update endpoint is intentionally idempotent-capable: absolute `quantity_on_hand` sets are idempotent, while `quantity_change` deltas are race-safe within the transaction.
- Inventory adjustments are not persisted as separate ledger rows; for a full adjustment audit trail, extend the structured-logger entry with a future `inventory_adjustments` table (see Design Decisions).

---

# Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid request body or query parameters |
| 401 Unauthorized | Authentication required |
| 403 Forbidden | Insufficient permissions (non-admin) |
| 404 Not Found | Variant or inventory record not found |
| 409 Conflict | Inventory already exists, or adjustment would drive stock below zero |
| 500 Internal Server Error | Unexpected server error |

Error responses use the shared project format:

```json
{
  "success": false,
  "message": "A variant with this public ID already has an inventory record."
}
```

---

# Notes

- Internal database IDs are never exposed; the variant's public ID keys every inventory resource.
- Timestamps are ISO 8601 UTC.
- Stock quantities are plain integers (the schema stores `INTEGER`; no decimal handling is needed).
- The customer-facing Product Catalog API is unaffected: product visibility continues to be derived from variant status, and stock is not exposed to customers (see Design Decisions).

---

# Orders Integration (Future)

The Inventory API surface is admin-only. The **prevent overselling** requirement is additionally enforced in the order flow through internal, transactional service operations that the Orders module will call — these are **not** REST endpoints:

- `reserveStock(variantId, quantity)` — inside the checkout transaction, locks the inventory row and reserves stock; fails when `quantity_available` is insufficient, so orders can never reserve more than what is on hand.
- `releaseStock(variantId, quantity)` — returns reserved stock on order cancellation or payment failure.
- `commitStock(variantId, quantity)` — on payment completion or fulfillment, decrements `quantity_on_hand` and releases the reservation.

These operations share the same row-locking and non-negative invariants as the admin `PATCH` endpoint and are documented here so the Orders module integrates against them.

---

# Design Decisions

- **Keyed by the variant's public ID, no schema change** — The `inventory` table has no `public_id` column and the 1:1 `product_variants_id` uniqueness makes the variant's public ID (`var_…`) a natural, stable public key. Adding a redundant `inventory.public_id` column was considered and rejected: it would require a migration and a new ID prefix for no access-path benefit. This resolves the earlier `docs/api/admin/admin.md` sketch that referenced `{inventory_public_id}`; the path parameter is now `{variant_public_id}`.
- **Admin-only resource** — Stock is internal operational data. Customers never read it, and the implemented product contract (visibility = non-deleted + ≥1 `ACTIVE` variant) is preserved without breaking changes. Exposing availability to customers is a possible future enhancement.
- **Flat admin list** — `GET /api/v1/admin/inventory` is a flat, paginated inventory dashboard rather than a nested product path, so a single low-stock/out-of-stock report can span the whole catalog without iterating products.
- **Absolute set and delta, both supported** — `quantity_on_hand` covers idempotent corrections/stocktakes; `quantity_change` covers atomic increases/decreases. Mutually exclusive to avoid ambiguous requests.
- **Overselling guard returns 409** — A delta that would drive stock below zero is a resource-state conflict (the current stock conflicts with the requested change), matching the project's 409 usage for state conflicts; validation failures remain 400.
- **`quantity_reserved` is read-only** — Reservations belong to the order lifecycle; exposing a write path would let admins corrupt order commitments.
- **No DELETE endpoint** — There is no requirement to remove inventory, and the row preserves order/reservation references; soft-deleted variants keep their stock records (governed by this API per `docs/api/products/product-variants.md`).
- **No adjustment ledger** — The schema has no adjustments table, so `reason` is audit-logged rather than persisted; a future `inventory_adjustments` table would turn the logger entry into a queryable ledger.
- **`last_stock_update` as the modified timestamp** — The schema has no `updated_at` on `inventory`; `last_stock_update` is refreshed on every successful write and doubles as the record's modification timestamp.
- **Response envelope** — All responses use the shared `{ success: true, data }` wrapper with the standard `pagination` object on list endpoints.
