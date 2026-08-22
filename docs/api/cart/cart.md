# Cart API

## Overview

The Cart API manages the signed-in customer's shopping cart — the container of product variants the customer intends to purchase before placing an order.

The API satisfies the documented Shopping Cart requirements:

- Create cart
- Add items
- Update quantity
- Remove items
- View cart
- Clear cart

The cart stores **product variants**, not products: every cart line references one product variant (see `docs/DATABASE.md` — `cart_items` links to `product_variants` via `fk_cart_items_product_variants`).

The API is **customer-only** and **fully authenticated**: every endpoint requires a session issued by the Authentication API, and the cart is always scoped to the authenticated user. There is no public (guest) cart and no admin surface.

The schema model is intentionally simple:

- `carts` — one row per user's cart (`public_id`, `users_id`); the cart itself stores **no quantities and no prices**.
- `cart_items` — one row per selected variant (`quantity`, `carts_id`, `product_variants_id`); prices are read live from the variant at read time (see **Design Decisions** — live pricing).

---

# Public Key

The `carts` table has a `public_id` column (`crt_…` prefix, already present in `PUBLIC_ID_PREFIXES`), so the cart has a stable public identifier.

The `cart_items` table has **no `public_id` column** (see `docs/DATABASE.md`). Because a cart holds **at most one line per variant** (merge-on-add semantics, service-enforced), the **variant's public ID (`var_…`) is the stable public key of a cart line** — the same keying pattern the Inventory API uses for inventory records.

- The user's own cart is addressed as `/api/v1/cart` (never by cart ID in the URL — there is exactly one cart per user).
- Cart lines are addressed as `/api/v1/cart/items/{variant_public_id}`.
- Internal cart/cart-item IDs are never exposed.
- No schema change is required to serve the API (see **Design Decisions**).

---

# Cart Object

```json
{
  "public_id": "crt_01J6XK8Q3M2N5B7V9C4D1E0F",
  "items_count": 2,
  "total_quantity": 5,
  "subtotal": "390.95",
  "items": [
    {
      "variant_public_id": "var_01J6XK8Q3M2N5B7V9C4D1E0F",
      "product_public_id": "prd_01J6XK8Q3M2N5B7V9C4D1E0F",
      "product_name": "Wireless Noise-Cancelling Headphones",
      "product_slug": "wireless-noise-cancelling-headphones",
      "sku": "SW-HP-001-BLK-M",
      "color": "Black",
      "size": "M",
      "image_url": "https://cdn.example.com/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/var_01K4X8Y9P4M4G8N6F9V2A1B3C/black-side.jpg",
      "price": "129.99",
      "discount_percentage": "10.00",
      "final_price": "116.99",
      "quantity": 3,
      "line_total": "350.97",
      "created_at": "2026-08-01T10:00:00Z",
      "updated_at": "2026-08-02T14:30:00Z"
    },
    {
      "variant_public_id": "var_01J6XK8Q3M2N5B7V9C4D1E0G",
      "product_public_id": "prd_01J6XK8Q3M2N5B7V9C4D1E0G",
      "product_name": "USB-C Fast Charger",
      "product_slug": "usb-c-fast-charger",
      "sku": "SW-UC-002-WHT",
      "color": "White",
      "size": null,
      "image_url": "https://cdn.example.com/prd_01K4X8Y9P4M4G8N6F9V2A1B3E/charger.jpg",
      "price": "19.99",
      "discount_percentage": null,
      "final_price": "19.99",
      "quantity": 2,
      "line_total": "39.98",
      "created_at": "2026-08-02T14:30:00Z",
      "updated_at": "2026-08-02T14:30:00Z"
    }
  ],
  "created_at": "2026-08-01T10:00:00Z",
  "updated_at": "2026-08-02T14:30:00Z"
}
```

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| public_id | string | No | Public cart identifier (`crt_…` prefix) |
| items_count | integer | No | Number of line items (distinct variants) in the cart |
| total_quantity | integer | No | Sum of all line quantities |
| subtotal | string | No | Sum of all line totals (decimal, 2 places; `"0.00"` for an empty cart) |
| items | array | No | The cart's Line Item objects, in insertion order |
| created_at | string | No | Cart creation timestamp (ISO 8601 UTC) |
| updated_at | string | No | Cart last-modification timestamp (ISO 8601 UTC) |

## Line Item Object

Each element of `items`:

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| variant_public_id | string | No | Public ID of the variant (`var_…`) — the stable public key of the line |
| product_public_id | string | No | Public ID of the parent product (`prd_…`) |
| product_name | string | No | Name of the parent product |
| product_slug | string | No | SEO-friendly URL slug of the parent product |
| sku | string | No | Variant SKU (max 80 characters) |
| color | string | Yes | Variant color attribute, when set |
| size | string | Yes | Variant size attribute, when set |
| image_url | string | Yes | Derived display image URL (see **Derived Fields**), or `null` when the variant/product has no images |
| price | string | No | Current selling price of the variant (decimal, 2 places) |
| discount_percentage | string | Yes | Current discount percentage of the variant (decimal, 2 places), when set |
| final_price | string | No | Derived unit price after discount (decimal, 2 places) |
| quantity | integer | No | Quantity of the variant in the cart (≥ 1) |
| line_total | string | No | Derived line amount: `final_price * quantity` (decimal, 2 places) |
| created_at | string | No | Line creation timestamp (ISO 8601 UTC) |
| updated_at | string | No | Line last-modification timestamp (ISO 8601 UTC) |

## Derived Fields

### final_price

```text
final_price = price * (1 - discount_percentage / 100)   when discount_percentage IS NOT NULL
final_price = price                                      otherwise
```

Rounded to 2 decimal places. Identical formula to the customer product detail (`docs/api/products/products.md`).

### line_total

```text
line_total = round2(final_price * quantity)
```

### subtotal

```text
subtotal = sum(line_total)   across all lines
```

Always returned as a decimal string with 2 places (`"0.00"` for an empty cart). Money arithmetic is decimal-based server-side; floating-point is never used.

### items_count / total_quantity

```text
items_count    = number of line items (distinct variants)
total_quantity = sum(quantity) across all lines
```

### image_url

Resolved server-side, in priority order:

1. First variant image: the `product_variant_images` row for the variant with the lowest `display_order` (ties broken by lowest `id`).
2. Fallback: the product's primary image (`product_images` row with `is_primary = true`).
3. Otherwise `null`.

## Projection

A single **Cart Object** is used for every endpoint. There is no admin projection — the cart surface is customer-only. Internal IDs, `deleted_at` (cart items are hard-deleted; the column does not exist on `carts`), and inventory data are never exposed.

---

# Customer Cart

All endpoints require an authenticated session. Any authenticated user (customer, admin, or super admin) may access **their own** cart; the cart is always resolved from the session user, never from a client-supplied user ID.

# View Cart

## Overview

Returns the authenticated user's cart with all of its line items and computed totals. Intended to render the cart page (line list, quantities, subtotal).

---

## Endpoint

```http
GET /api/v1/cart
```

---

## Authentication

| Requirement | Value |
|-------------|-------|
| Authentication | Required |

---

## Authorization

Any authenticated user. The cart is scoped to the session user; there is no cross-user access.

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

> None.

---

## Successful Response

**200 OK**

### Response Body

```json
{
  "success": true,
  "data": {
    "public_id": "crt_01J6XK8Q3M2N5B7V9C4D1E0F",
    "items_count": 2,
    "total_quantity": 5,
    "subtotal": "390.95",
    "items": [
      {
        "variant_public_id": "var_01J6XK8Q3M2N5B7V9C4D1E0F",
        "product_public_id": "prd_01J6XK8Q3M2N5B7V9C4D1E0F",
        "product_name": "Wireless Noise-Cancelling Headphones",
        "product_slug": "wireless-noise-cancelling-headphones",
        "sku": "SW-HP-001-BLK-M",
        "color": "Black",
        "size": "M",
        "image_url": "https://cdn.example.com/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/var_01K4X8Y9P4M4G8N6F9V2A1B3C/black-side.jpg",
        "price": "129.99",
        "discount_percentage": "10.00",
        "final_price": "116.99",
        "quantity": 3,
        "line_total": "350.97",
        "created_at": "2026-08-01T10:00:00Z",
        "updated_at": "2026-08-02T14:30:00Z"
      },
      {
        "variant_public_id": "var_01J6XK8Q3M2N5B7V9C4D1E0G",
        "product_public_id": "prd_01J6XK8Q3M2N5B7V9C4D1E0G",
        "product_name": "USB-C Fast Charger",
        "product_slug": "usb-c-fast-charger",
        "sku": "SW-UC-002-WHT",
        "color": "White",
        "size": null,
        "image_url": "https://cdn.example.com/prd_01K4X8Y9P4M4G8N6F9V2A1B3E/charger.jpg",
        "price": "19.99",
        "discount_percentage": null,
        "final_price": "19.99",
        "quantity": 2,
        "line_total": "39.98",
        "created_at": "2026-08-02T14:30:00Z",
        "updated_at": "2026-08-02T14:30:00Z"
      }
    ],
    "created_at": "2026-08-01T10:00:00Z",
    "updated_at": "2026-08-02T14:30:00Z"
  }
}
```

### Response Headers

> None.

---

## Processing Flow

1. Client sends the request with an authenticated session.
2. API resolves the user's cart by `users_id` (one cart per user, service-enforced).
3. API loads the cart's lines joined to their variants and products.
4. API computes derived fields per line (`final_price`, `line_total`, `image_url`) and cart totals (`items_count`, `total_quantity`, `subtotal`).
5. API returns **200 OK** with the Cart Object, or **404** when the user has no cart.

---

## Business Rules

- The cart is resolved from the session user; a client can never read another user's cart.
- **No cart row → 404** ("Cart not found for this user"). There is no implicit empty cart; the cart is created by the first `POST /api/v1/cart/items`.
- **An empty cart row (all lines removed) → 200** with `items: []`, `items_count: 0`, `total_quantity: 0`, and `subtotal: "0.00"`. Removing the last line does not delete the cart row; only `DELETE /api/v1/cart` does.
- Lines are returned in insertion order (`cart_items.created_at` ascending, ties by `id` ascending).
- Prices are computed live from the current variant price/discount; the cart stores no price snapshot (see **Design Decisions**).
- Lines whose variant was soft-deleted or deactivated after being added are still returned; purchasability and availability are enforced at checkout (see **Notes**).

---

## Error Responses

| Status | Reason |
|--------|--------|
| 401 Unauthorized | Missing or invalid session |
| 404 Not Found | The user has no cart yet |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Endpoint is behind the shared `authentication` middleware.
- The cart is always scoped to the session user's internal ID; no user or cart identifier is accepted from the client.
- Internal cart/cart-item IDs are never exposed.

---

## Notes

- This endpoint never creates a cart (a read must not have side effects); use `POST /api/v1/cart/items` to create the cart implicitly.

---

# Add Cart Item

## Overview

Adds a product variant to the authenticated user's cart. If the user has no cart, one is created in the same transaction (the documented "Create cart" requirement). If the variant is already in the cart, the existing line's quantity is **incremented** (merge-on-add) instead of creating a duplicate line.

---

## Endpoint

```http
POST /api/v1/cart/items
```

---

## Authentication

| Requirement | Value |
|-------------|-------|
| Authentication | Required |

---

## Authorization

Any authenticated user. The cart is scoped to the session user.

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
| variant_public_id | string | Yes | Public ID of a purchasable variant (`var_…` format) |
| quantity | integer | No | Quantity to add, ≥ 1 and ≤ 999. Default: `1` |

### Example

```json
{
  "variant_public_id": "var_01J6XK8Q3M2N5B7V9C4D1E0F",
  "quantity": 2
}
```

---

## Successful Response

**200 OK**

### Response Body

The full Cart Object after the change (see **View Cart** for the shape). `200` is used rather than `201` because the request is a merge: it may create the cart, create a new line, or increment an existing line, and the response always reflects the resulting cart state.

```json
{
  "success": true,
  "data": {
    "public_id": "crt_01J6XK8Q3M2N5B7V9C4D1E0F",
    "items_count": 1,
    "total_quantity": 2,
    "subtotal": "233.98",
    "items": [
      {
        "variant_public_id": "var_01J6XK8Q3M2N5B7V9C4D1E0F",
        "product_public_id": "prd_01J6XK8Q3M2N5B7V9C4D1E0F",
        "product_name": "Wireless Noise-Cancelling Headphones",
        "product_slug": "wireless-noise-cancelling-headphones",
        "sku": "SW-HP-001-BLK-M",
        "color": "Black",
        "size": "M",
        "image_url": "https://cdn.example.com/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/var_01K4X8Y9P4M4G8N6F9V2A1B3C/black-side.jpg",
        "price": "129.99",
        "discount_percentage": "10.00",
        "final_price": "116.99",
        "quantity": 2,
        "line_total": "233.98",
        "created_at": "2026-08-01T10:00:00Z",
        "updated_at": "2026-08-01T10:00:00Z"
      }
    ],
    "created_at": "2026-08-01T10:00:00Z",
    "updated_at": "2026-08-01T10:00:00Z"
  }
}
```

### Response Headers

> None.

---

## Processing Flow

1. Client sends the request with an authenticated session.
2. API validates the request body (`variant_public_id`, `quantity`).
3. API resolves the variant by its public ID; a missing, soft-deleted, or non-`ACTIVE` variant returns **404** (it is not purchasable, matching the customer catalog visibility rules).
4. API begins a transaction:
   - If the user has no cart, API creates one (`crt_…` public ID, `created_at`/`updated_at` set).
   - If the variant is already in the cart, API increments the line's `quantity` by the requested amount.
   - Otherwise, API creates the line with the requested `quantity`.
5. API commits and re-reads the cart with all lines and derived totals.
6. API returns **200 OK** with the full Cart Object.

---

## Business Rules

- `variant_public_id` must reference a non-deleted variant with `status = ACTIVE`; anything else is **404** (the customer catalog treats non-visible variants as not found).
- The user's cart is created lazily on the first add, inside the same transaction as the first line — satisfying "Create cart" with no dedicated create endpoint.
- **One line per variant**: adding a variant already present increments its quantity (merge-on-add) rather than duplicating the line. Uniqueness of `(cart, variant)` is service-enforced (the schema has no composite unique constraint; see **Design Decisions**).
- `quantity` must be ≥ 1 (mirrors the database check constraint on `cart_items.quantity`) and ≤ 999 (API-level limit).
- If the merge would push the line's quantity above 999, the request returns **400** and no change is applied.
- Adding to a cart that does not yet exist creates it; adding to a cart that exists but has an empty `items` array behaves the same as any other add.
- The cart creation and line write happen in a single `prisma.$transaction`; the response is only produced after commit.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid request body (malformed `variant_public_id`, `quantity < 1`, `quantity > 999`, merged quantity would exceed 999) |
| 401 Unauthorized | Missing or invalid session |
| 404 Not Found | Variant does not exist, is soft-deleted, or is not `ACTIVE` |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Endpoint is behind the shared `authentication` middleware.
- `variant_public_id` is resolved to an internal ID inside the service; the public ID is the only variant identifier accepted.
- The cart is always created/resolved for the session user; a client cannot target another user's cart.

---

## Notes

- There is no bulk-add endpoint; each request adds one variant (the quantity field covers "add several").
- The endpoint returns the full cart so clients can re-render the cart bar/page from one response.

---

# Update Cart Item Quantity

## Overview

Sets the absolute quantity of a cart line. The value replaces the current quantity (idempotent set — sending the current value is a no-op success). Intended for quantity steppers on the cart page.

---

## Endpoint

```http
PATCH /api/v1/cart/items/{variant_public_id}
```

---

## Authentication

| Requirement | Value |
|-------------|-------|
| Authentication | Required |

---

## Authorization

Any authenticated user. The cart is scoped to the session user.

---

## Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| Cookie | Yes | `session` cookie issued at login |

---

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| variant_public_id | string | Yes | Public ID of the variant whose cart line is updated (`var_…`) |

---

## Query Parameters

> None.

---

## Request Body

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| quantity | integer | Yes | New quantity, ≥ 1 and ≤ 999. Absolute set (not a delta) |

### Example

```json
{
  "quantity": 4
}
```

---

## Successful Response

**200 OK**

### Response Body

The full Cart Object after the change (see **View Cart** for the shape).

```json
{
  "success": true,
  "data": {
    "public_id": "crt_01J6XK8Q3M2N5B7V9C4D1E0F",
    "items_count": 1,
    "total_quantity": 4,
    "subtotal": "467.96",
    "items": [
      {
        "variant_public_id": "var_01J6XK8Q3M2N5B7V9C4D1E0F",
        "product_public_id": "prd_01J6XK8Q3M2N5B7V9C4D1E0F",
        "product_name": "Wireless Noise-Cancelling Headphones",
        "product_slug": "wireless-noise-cancelling-headphones",
        "sku": "SW-HP-001-BLK-M",
        "color": "Black",
        "size": "M",
        "image_url": "https://cdn.example.com/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/var_01K4X8Y9P4M4G8N6F9V2A1B3C/black-side.jpg",
        "price": "129.99",
        "discount_percentage": "10.00",
        "final_price": "116.99",
        "quantity": 4,
        "line_total": "467.96",
        "created_at": "2026-08-01T10:00:00Z",
        "updated_at": "2026-08-02T16:45:00Z"
      }
    ],
    "created_at": "2026-08-01T10:00:00Z",
    "updated_at": "2026-08-02T16:45:00Z"
  }
}
```

### Response Headers

> None.

---

## Processing Flow

1. Client sends the request with an authenticated session.
2. API validates the path parameter and request body (`quantity`).
3. API resolves the user's cart; **404** when the user has no cart.
4. API resolves the line by `(cart, variant_public_id)`; **404** when the variant is not in the cart.
5. API updates the line's `quantity` and `updated_at`.
6. API returns **200 OK** with the full Cart Object.

---

## Business Rules

- The update is an **absolute set**: the stored quantity is replaced by the request value. Repeating the same value is a successful no-op (idempotent).
- `quantity` must be ≥ 1 (mirrors the database check constraint) and ≤ 999 (API-level limit).
- The line must already exist in the cart; a variant that is not in the cart returns **404** (no implicit line creation — use `POST /api/v1/cart/items` to add).
- The user's cart must exist; a user with no cart returns **404**.
- The line's `updated_at` (and the cart's `updated_at`) is refreshed on every successful change.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid request body (`quantity < 1`, `quantity > 999`, missing `quantity`) |
| 401 Unauthorized | Missing or invalid session |
| 404 Not Found | The user has no cart, or the variant is not in the cart |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Endpoint is behind the shared `authentication` middleware.
- The cart and its line are resolved for the session user only; another user's cart can never be modified.

---

## Notes

- To remove a line entirely, use `DELETE /api/v1/cart/items/{variant_public_id}` rather than setting `quantity` to `0` (which is rejected by validation).

---

# Remove Cart Item

## Overview

Removes a single line from the authenticated user's cart. The line row is hard-deleted; the cart row (and its remaining lines) are preserved.

---

## Endpoint

```http
DELETE /api/v1/cart/items/{variant_public_id}
```

---

## Authentication

| Requirement | Value |
|-------------|-------|
| Authentication | Required |

---

## Authorization

Any authenticated user. The cart is scoped to the session user.

---

## Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| Cookie | Yes | `session` cookie issued at login |

---

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| variant_public_id | string | Yes | Public ID of the variant whose cart line is removed (`var_…`) |

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

1. Client sends the request with an authenticated session.
2. API validates the path parameter.
3. API resolves the user's cart; **404** when the user has no cart.
4. API resolves the line by `(cart, variant_public_id)`; **404** when the variant is not in the cart.
5. API hard-deletes the line row.
6. API returns **204 No Content**. The cart row is preserved even when this was the last line.

---

## Business Rules

- Removing a line that is not in the cart returns **404** (the line does not exist for this user); the removal is not treated as an idempotent no-op.
- Removing the last line leaves the (empty) cart row in place: a subsequent `GET /api/v1/cart` returns **200** with `items: []`.
- The cart row is only deleted by `DELETE /api/v1/cart`.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Malformed `variant_public_id` |
| 401 Unauthorized | Missing or invalid session |
| 404 Not Found | The user has no cart, or the variant is not in the cart |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Endpoint is behind the shared `authentication` middleware.
- Deletion is scoped to the session user's cart; another user's lines can never be removed.

---

## Notes

- This endpoint removes one line; to empty the whole cart use `DELETE /api/v1/cart`.

---

# Clear Cart

## Overview

Empties the authenticated user's cart. All line items are hard-deleted and the cart row itself is deleted in a single transaction. Afterward the user has **no cart** until the next add (see Business Rules).

---

## Endpoint

```http
DELETE /api/v1/cart
```

---

## Authentication

| Requirement | Value |
|-------------|-------|
| Authentication | Required |

---

## Authorization

Any authenticated user. The cart is scoped to the session user.

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

1. Client sends the request with an authenticated session.
2. API resolves the user's cart; **404** when the user has no cart.
3. API deletes all of the cart's line items and then the cart row, inside one `prisma.$transaction`.
4. API returns **204 No Content**.

---

## Business Rules

- Clearing a cart the user does not have returns **404** (there is nothing to clear).
- The cart and its lines are hard-deleted (the `carts` table has no `deleted_at` column and there is no restore requirement).
- After clearing, `GET /api/v1/cart` returns **404** until the user adds an item again (which recreates the cart).
- The deletion is transactional: the cart can never be left with orphaned lines.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 401 Unauthorized | Missing or invalid session |
| 404 Not Found | The user has no cart |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Endpoint is behind the shared `authentication` middleware.
- Only the session user's own cart can be cleared.

---

## Notes

- This is the only endpoint that deletes the cart row itself; line removal (`DELETE /api/v1/cart/items/{variant_public_id}`) preserves it.

---

# Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid request body or path parameter |
| 401 Unauthorized | Authentication required |
| 404 Not Found | User has no cart, variant not found / not purchasable, or variant not in the cart |
| 500 Internal Server Error | Unexpected server error |

Error responses use the shared project format:

```json
{
  "success": false,
  "message": "Variant var_01J6XK8Q3M2N5B7V9C4D1E0F is not in the cart."
}
```

---

# Notes

- Internal database IDs are never exposed; the cart uses its own `crt_…` public ID and lines are keyed by `var_…` variant public IDs.
- Timestamps are ISO 8601 UTC.
- Money values (`price`, `final_price`, `line_total`, `subtotal`) are decimal strings with 2 places; server-side arithmetic is decimal-based (never floating point).
- Prices are computed live at read time from the current variant values; the cart stores only quantities.
- Stock availability is **not** exposed through the cart (the customer product contract is unchanged); the oversell guard runs at checkout through the Inventory API's transactional order operations (`reserveStock`/`releaseStock`/`commitStock` — see `docs/api/inventory/inventory.md`).
- The Orders module is responsible for validating purchasability and stock at checkout; lines referencing variants that were soft-deleted or deactivated after being added are still returned by the cart so the customer can remove them.
- There is no pagination: the cart is a small collection and the full item list is always returned.
- There is no admin surface: stock and catalog management happen through the Inventory and Product Catalog admin APIs.

---

# Design Decisions

- **Singular `/api/v1/cart`, one cart per user** — The API models the customer's own cart as a singleton resource addressed as `/api/v1/cart` (mirroring the `/users/me` precedent), rather than plural `/carts/{cart_public_id}`. There is exactly one cart per user (service-enforced) and the user never addresses a cart by ID. The schema's capacity for multiple carts per user (no unique constraint on `users_id`) is intentionally unused: no requirement demands saved carts or cart merging. Supporting multiple carts later would be a breaking API change and is out of scope.
- **Lazily created cart** — The cart is created on the first `POST /api/v1/cart/items` inside the same transaction as the first line, satisfying the "Create cart" requirement without a dedicated create endpoint. `GET /api/v1/cart` never creates a cart (a read must have no side effects) and returns **404** until one exists — the same "no implicit empty record" convention the Inventory API uses for variants without inventory.
- **Cart items keyed by `variant_public_id`, no schema change** — `cart_items` has no `public_id` column, and merge-on-add guarantees at most one line per variant per cart, so the variant's public ID is a natural, stable public key. Adding a `cart_items.public_id` column was considered and rejected for the same reason the Inventory API rejected one: a migration and a new ID prefix for no access-path benefit. This mirrors the inventory keying decision (`docs/api/inventory/inventory.md`).
- **Merge-on-add** — Adding a variant already in the cart increments its quantity instead of creating a duplicate line. Uniqueness of `(cart, variant)` is service-enforced inside the transaction; the schema has no composite unique constraint. A future `@@unique([carts_id, product_variants_id])` index is a possible hardening but is not required by the contract.
- **One-cart-per-user concurrency** — The service enforces one cart per user at the application level. Every mutating operation (`POST /items`, `PATCH /items/{variant_public_id}`, `DELETE /items/{variant_public_id}`, `DELETE /cart`) acquires the same transaction-scoped PostgreSQL advisory lock keyed by the user's internal ID before reading or writing state, so concurrent first-adds are serialized and cart mutations cannot interleave with checkout (which holds the identical lock). A concurrent mutation that loses the race against a checkout re-validates the cart inside its own locked transaction and degrades to the documented **404** ("Cart not found for this user") instead of a server error; a future unique index on `carts.users_id` is documented as the database-level hardening.
- **Live pricing** — `cart_items` stores only `quantity`; `price`, `discount_percentage`, and the derived `final_price`/`line_total`/`subtotal` are computed at read time from the current variant values. Price snapshots belong to order items at checkout, not to the cart. A cart line therefore always reflects current catalog pricing, and a price change between add and checkout is picked up automatically (and charged) at checkout.
- **No stock availability in the cart** — Exposing availability would change the customer product contract that the merged products module deliberately keeps stock-free. The oversell guard lives in the order flow (`reserveStock` in the Inventory API's Orders Integration contract). Customer-facing availability (e.g., a `max_available` on the line) is documented as a possible future enhancement.
- **Absolute quantity set on `PATCH`** — Cart quantity steppers are absolute by nature, so `PATCH /cart/items/{variant_public_id}` replaces the quantity (idempotent) rather than accepting a delta. A signed-delta mode can be added later without breaking the contract if needed.
- **`POST /cart/items` returns 200, not 201** — The request is a merge operation that may create a cart, create a line, or increment an existing line; the response always reflects the resulting cart state. A fixed `201` would misreport the "increment" case.
- **Hard deletes for lines and cart** — `cart_items` and `carts` have no `deleted_at` column (and no restore requirement exists), so removal is a hard delete. This differs from soft-delete domains (users, addresses, products) where historical integrity demands retention.
- **404 for missing lines and missing carts** — A line that is not in the cart returns 404 (the resource does not exist for this user), matching the project's 404-not-leak semantics; removals are not treated as idempotent no-ops.
- **Empty cart row is distinct from no cart** — Removing the last line preserves the cart row (GET → 200, empty), while `DELETE /cart` removes the row (GET → 404). This keeps the API deterministic and side-effect-free for readers.
- **No pagination on cart items** — A cart is a bounded personal collection; the full line list is always returned, and totals depend on the whole list. Pagination would complicate subtotal computation for no practical benefit.
- **`image_url` fallback chain** — Variant images carry no `is_primary` flag, so the line image is the first variant image by `display_order` (ties by `id`), falling back to the product's primary image, then `null`. This prefers variant-accurate imagery while degrading gracefully for variants without images.
- **Response envelope** — All success responses use the shared `{ success: true, data }` wrapper; deletions return `204 No Content`; errors use the shared `{ success: false, message }` format.
