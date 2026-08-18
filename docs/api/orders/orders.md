# Orders API

## Overview

The Orders API manages customer purchase orders — the immutable record of a completed checkout — and the administrative order lifecycle (confirmation, fulfillment, shipping, cancellation, returns, refunds).

The API satisfies the documented Orders and Order Items requirements:

- Checkout (place an order from the customer's cart)
- View order history
- View order details
- Immutable order snapshots (customer, items, prices, discounts, totals, shipping information, payment information)
- Order items snapshot: product name, variant, SKU, quantity, unit price, discount, subtotal
- Payments recorded per order (mock provider today; provider-agnostic by design)
- Administrative order management

The API is **authenticated throughout**: customer endpoints require a session issued by the Authentication API and are always scoped to the session user; administrator endpoints additionally require the `admin` or `super_admin` role.

Checkout is the **only** write operation on the customer side. It consumes the session user's cart (`docs/api/cart/cart.md`) inside a single database transaction, snapshots every line, reserves and commits stock through the Inventory API's transactional order operations (`reserveStock`/`commitStock` — see `docs/api/inventory/inventory.md`), processes payment through a provider abstraction (the **mock provider** for v1), records the payment, and clears the cart. Once placed, an order is **immutable**: its prices, address, and item descriptions never change even when the catalog or saved addresses are later edited (see **Schema Changes Required**).

The schema model (see `docs/DATABASE.md`):

- `orders` — one row per order (`public_id`, `order_number`, `status`, totals, `placed_at`, `users_id`, `coupons_id`, `user_addresses_id`).
- `order_items` — one row per purchased variant (`quantity`, `unit_price`, `total_amount`, `orders_id`, `product_variants_id`).
- `payments` — one row per payment attempt (`amount`, `payment_method`, `payment_status`, `transaction_reference`, `paid_at`, `users_id`).
- `shipments` — at most one row per order (address snapshot columns + `status`, `carrier`, `tracking_number`, `shipped_at`, `delivered_at`, `orders_id`).
- `coupons` / `coupon_usages` — optional order-level discount.

---

# Public Key

The `orders` table has a `public_id` column (`ord_…` prefix, already present in `PUBLIC_ID_PREFIXES`), so an order has a stable public identifier.

The `order_items` table has **no `public_id` column** (see `docs/DATABASE.md`). Order items are **embedded** in the Order Object and are never addressed individually (there is no per-item endpoint), so no item public key is required: each item carries the purchased variant's public ID (`var_…`) as its stable reference. The `PUBLIC_ID_PREFIXES.ORDER_ITEM` (`oit_…`) prefix is reserved for future use (e.g., a per-item refund/return surface).

The `payments` table has **no `public_id` column** today. Because orders must expose payment information, the required schema change adds one (`pay_…` prefix, already present in `PUBLIC_ID_PREFIXES`) plus an `orders_id` link (see **Schema Changes Required**).

- Orders are addressed as `/api/v1/orders/{order_public_id}` (customer) and `/api/v1/admin/orders/{order_public_id}` (admin).
- Internal order/item/payment/shipment IDs are never exposed.
- A customer never addresses another user's order: scoping is always resolved from the session user's internal ID.

---

# Order Status Reference

The API exposes the `order_status` enum values as lowercase strings (`RETURNED` → `returned`).

| Status | Meaning |
| --- | --- |
| `pending` | Order placed; payment not yet paid (reservation active). v1 mock payment succeeds inline, so orders normally skip this state. |
| `confirmed` | Payment paid and stock committed. Terminal for customer interaction; first fulfillment state. |
| `processing` | Fulfillment started (admin). |
| `shipped` | Handed to carrier; the checkout-created `shipments` row is updated with carrier/tracking and `shipped_at` (admin). |
| `delivered` | Marked delivered (admin). |
| `cancelled` | Order terminated without charge; reservation released. |
| `returned` | Goods returned after delivery (admin). |
| `refunded` | Money returned after cancellation or return (admin). |

## Lifecycle

```text
                 ┌───────────┐
  checkout ───►  │  pending  │ ── payment success ──►  confirmed
                 └─────┬─────┘
                       │ payment failure / cancelled
                       ▼
                  cancelled

 confirmed ──► processing ──► shipped ──► delivered ──► returned ──► refunded
      │             │             │
      └──► cancelled ──► refunded ─┘
```

Allowed transitions are enforced by the administrator status endpoint; see **Update Order Status**.

---

# Order Object

```json
{
  "public_id": "ord_01J6XK8Q3M2N5B7V9C4D1E0F",
  "order_number": "ORD-00000042",
  "status": "confirmed",
  "placed_at": "2026-08-10T09:30:00Z",
  "subtotal": "293.95",
  "discount_amount": "20.00",
  "shipping_fee": "10.00",
  "tax_amount": "0.00",
  "total_amount": "283.95",
  "notes": "Please leave at the front desk.",
  "shipping_address": {
    "recipient_name": "Ahmed Hassan",
    "phone_number": "+201001234567",
    "country": "Egypt",
    "state": "Cairo Governorate",
    "city": "Cairo",
    "address_1": "12 Nile Street, Apt 5",
    "address_2": null,
    "postal_code": "11511"
  },
  "payment": {
    "public_id": "pay_01J6XK8Q3M2N5B7V9C4D1E0F",
    "status": "paid",
    "method": "mock",
    "provider": "mock",
    "transaction_reference": "mock_01J6XK8Q3M2N5B7V9C4D1E0F",
    "amount": "283.95",
    "paid_at": "2026-08-10T09:30:01Z"
  },
  "items": [
    {
      "product_public_id": "prd_01J6XK8Q3M2N5B7V9C4D1E0F",
      "variant_public_id": "var_01J6XK8Q3M2N5B7V9C4D1E0F",
      "product_name": "Wireless Noise-Cancelling Headphones",
      "product_slug": "wireless-noise-cancelling-headphones",
      "sku": "SW-HP-001-BLK-M",
      "color": "Black",
      "size": "M",
      "unit_price": "116.99",
      "discount_percentage": "10.00",
      "quantity": 2,
      "total_amount": "233.98",
      "created_at": "2026-08-10T09:30:00Z"
    },
    {
      "product_public_id": "prd_01J6XK8Q3M2N5B7V9C4D1E0G",
      "variant_public_id": "var_01J6XK8Q3M2N5B7V9C4D1E0G",
      "product_name": "USB-C Fast Charger",
      "product_slug": "usb-c-fast-charger",
      "sku": "SW-UC-002-WHT",
      "color": "White",
      "size": null,
      "unit_price": "19.99",
      "discount_percentage": null,
      "quantity": 3,
      "total_amount": "59.97",
      "created_at": "2026-08-10T09:30:00Z"
    }
  ],
  "created_at": "2026-08-10T09:30:00Z",
  "updated_at": "2026-08-10T09:30:01Z"
}
```

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| public_id | string | No | Public order identifier (`ord_…` prefix) |
| order_number | string | No | Human-readable unique order number (`ORD-` + zero-padded internal ID) |
| status | string | No | Order status (see **Order Status Reference**) |
| placed_at | string | No | Timestamp the order was placed (ISO 8601 UTC) |
| subtotal | string | No | Sum of all item `total_amount` values (decimal, 2 places) |
| discount_amount | string | No | Order-level discount applied (decimal, 2 places; `"0.00"` without a coupon) |
| shipping_fee | string | No | Shipping fee charged (decimal, 2 places) |
| tax_amount | string | No | Tax charged (decimal, 2 places; `"0.00"` — no tax engine in v1) |
| total_amount | string | No | Final charged amount: `subtotal - discount_amount + shipping_fee + tax_amount` |
| notes | string | Yes | Customer notes, when provided |
| shipping_address | object | No | Immutable snapshot of the shipping address (see **Shipping Address Object**) |
| payment | object | Yes | Payment record for the order (see **Payment Object**); present once a payment attempt exists |
| items | array | No | The order's Order Item objects (see **Order Item Object**) |
| created_at | string | No | Order creation timestamp (ISO 8601 UTC) |
| updated_at | string | No | Order last-modification timestamp (ISO 8601 UTC) |

## Order Item Object

Each element of `items` is an **immutable snapshot** taken at checkout; it never changes when the underlying product or variant is later edited:

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| product_public_id | string | No | Public ID of the parent product at checkout (`prd_…`) |
| variant_public_id | string | No | Public ID of the purchased variant (`var_…`) — the item's stable reference |
| product_name | string | No | Snapshot of the product name at checkout |
| product_slug | string | No | Snapshot of the product slug at checkout |
| sku | string | No | Snapshot of the variant SKU at checkout |
| color | string | Yes | Snapshot of the variant color attribute, when set at checkout |
| size | string | Yes | Snapshot of the variant size attribute, when set at checkout |
| unit_price | string | No | Snapshot of the charged unit price (final price after discount) at checkout (decimal, 2 places) |
| discount_percentage | string | Yes | Snapshot of the variant discount percentage at checkout, when set (decimal, 2 places) |
| quantity | integer | No | Quantity purchased (≥ 1) |
| total_amount | string | No | Item line total: `unit_price * quantity` (decimal, 2 places) |
| created_at | string | No | Item creation timestamp (ISO 8601 UTC) |

> **Note on snapshots:** the applied schema stores the full checkout-time product context on `order_items` — the price snapshot (`unit_price`, `total_amount`) plus the `product_name`, `product_slug`, `sku`, `variant_color`, `variant_size`, `variant_weight`, `variant_width`, `variant_length`, `variant_height`, and `discount_percentage` columns (see **Schema Changes Required §1**), so order history never reflects live catalog edits and the "Historical order data must never change when products are edited" requirement holds. The Order Item Object exposes the `color`/`size` fields; the physical dimensions are snapshotted for future fulfillment use and are intentionally not part of the v1 contract.

## Shipping Address Object

An immutable copy of the saved address selected at checkout (`user_addresses` row copied at order time):

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| recipient_name | string | No | Recipient name at checkout |
| phone_number | string | No | Contact phone at checkout |
| country | string | No | Country at checkout |
| state | string | Yes | State / governorate at checkout, when set |
| city | string | No | City at checkout |
| address_1 | string | No | Address line 1 at checkout |
| address_2 | string | Yes | Address line 2 at checkout, when set |
| postal_code | string | Yes | Postal code at checkout, when set |

> **Note:** the snapshot is stored on the `shipments` row created at checkout (address columns mirroring `user_addresses`, with `postal_code` mapping `user_addresses.zip_code`), so later edits to the saved address never alter historical order data. `orders.user_addresses_id` remains the provenance FK.

## Payment Object

The payment record for the order:

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| public_id | string | No | Public payment identifier (`pay_…` prefix) |
| status | string | No | Payment status: `pending`, `authorized`, `paid`, `failed`, `refunded` (`authorized` reserved for future asynchronous capture flows) |
| method | string | No | Payment method used (v1: `mock`) |
| provider | string | No | Payment provider (v1: `mock`; future: `stripe`, `paymob`, `paypal`, …) |
| transaction_reference | string | Yes | Provider transaction reference, when the attempt produced one |
| amount | string | No | Charged amount (decimal, 2 places) |
| paid_at | string | Yes | Timestamp the payment was paid (ISO 8601 UTC), when paid |

> **Note:** `payments` now carries a `pay_…` public_id and a 1:1 link to `orders` via the unique `orders_id`; payment status uses the `payment_status` enum (see **Schema Changes Required** for the applied changes).

---

# Derived Fields

## Totals

```text
item_total        = unit_price * quantity                          (per item, stored as order_items.total_amount)
subtotal          = sum(item_total)                                 across all items
discount_amount   = coupon discount applied at order level          (coupon_usages.discount_amount)
shipping_fee      = computed shipping fee                           (see Shipping)
tax_amount        = "0.00"                                          (no tax engine in v1)
total_amount      = subtotal - discount_amount + shipping_fee + tax_amount
```

Money arithmetic is decimal-based server-side; floating-point is never used. All money fields are decimal strings with 2 places.

## Shipping

No shipping-rate engine exists in v1; the fee is a single configurable constant with a free-shipping threshold:

```text
shipping_fee = "0.00"   when subtotal >= FREE_SHIPPING_THRESHOLD   (e.g., 500.00)
shipping_fee = FLAT_SHIPPING_FEE   otherwise                       (e.g., "10.00")
```

Both values are server-side configuration; a client can never supply a shipping fee. The `orders.shipping_cost` and `orders.shipping_fee` columns are both populated with the same computed value (the columns are duplicates in the current schema; `shipping_fee` is the canonical field in the API contract).

## Order Number

`order_number` is derived from the internal auto-increment ID after insert, inside the checkout transaction:

```text
order_number = "ORD-" + zero-padded internal ID to 8 digits   (e.g., "ORD-00000042")
```

Unique by construction (the internal ID is unique). Human-readable, sortable, and stable.

---

# Projection

The **customer Order Object** is used for the customer endpoints (`GET /api/v1/orders`, `GET /api/v1/orders/{order_public_id}`) and the `POST /api/v1/orders` response.

The **administrator projection** extends it with the customer summary (`customer_public_id`, `customer_name`, `customer_email`, `customer_phone_number`) and the shipment (`public_id`, `status`, `carrier`, `tracking_number`, `shipped_at`, `delivered_at`) — present for every order because the `shipments` row is created at checkout. The administrator **list** uses a lighter row object (see **List Orders**).

Internal IDs, `deleted_at` (order items are never deleted; the columns exist for schema parity and are never set or exposed), and inventory data are never exposed. Coupon details are never exposed (only the resulting `discount_amount`).

---

# Customer Orders

All endpoints require an authenticated session. Any authenticated user (customer, admin, or super admin) may access **their own** orders; orders are always resolved from the session user, never from a client-supplied user ID.

# Place Order

## Overview

Checkout: consumes the session user's cart and creates an order with immutable snapshots, a payment record, and committed stock — all in one transaction. This is the documented "Checkout" and "Place orders" requirement. The order is charged with the **mock payment provider** (synchronous, always succeeds), so a successful response returns the order in the `confirmed` state with stock committed.

---

## Endpoint

```http
POST /api/v1/orders
```

---

## Authentication

| Requirement | Value |
|-------------|-------|
| Authentication | Required |

---

## Authorization

Any authenticated user. The order is created for, and the cart consumed from, the session user only.

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
| address_public_id | string | Yes | Public ID of a saved address (`adr_…`) belonging to the session user; must exist and not be soft-deleted |
| payment_method | string | Yes | Payment method; v1 supports only `mock` (the mock provider) |
| coupon_code | string | No | Coupon code to apply; validated against the `coupons` table (see **Business Rules**) |
| notes | string | No | Free-form customer notes; max 1000 characters |

### Example

```json
{
  "address_public_id": "adr_01K4X8Y9P4M4G8N6F9V2A1B3C",
  "payment_method": "mock",
  "coupon_code": "WELCOME10",
  "notes": "Please leave at the front desk."
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
    "public_id": "ord_01J6XK8Q3M2N5B7V9C4D1E0F",
    "order_number": "ORD-00000042",
    "status": "confirmed",
    "placed_at": "2026-08-10T09:30:00Z",
    "subtotal": "293.95",
    "discount_amount": "20.00",
    "shipping_fee": "10.00",
    "tax_amount": "0.00",
    "total_amount": "283.95",
    "notes": "Please leave at the front desk.",
    "shipping_address": {
      "recipient_name": "Ahmed Hassan",
      "phone_number": "+201001234567",
      "country": "Egypt",
      "state": "Cairo Governorate",
      "city": "Cairo",
      "address_1": "12 Nile Street, Apt 5",
      "address_2": null,
      "postal_code": "11511"
    },
    "payment": {
      "public_id": "pay_01J6XK8Q3M2N5B7V9C4D1E0F",
      "status": "paid",
      "method": "mock",
      "provider": "mock",
      "transaction_reference": "mock_01J6XK8Q3M2N5B7V9C4D1E0F",
      "amount": "283.95",
      "paid_at": "2026-08-10T09:30:01Z"
    },
    "items": [
      {
        "product_public_id": "prd_01J6XK8Q3M2N5B7V9C4D1E0F",
        "variant_public_id": "var_01J6XK8Q3M2N5B7V9C4D1E0F",
        "product_name": "Wireless Noise-Cancelling Headphones",
        "product_slug": "wireless-noise-cancelling-headphones",
        "sku": "SW-HP-001-BLK-M",
        "color": "Black",
        "size": "M",
        "unit_price": "116.99",
        "discount_percentage": "10.00",
        "quantity": 2,
        "total_amount": "233.98",
        "created_at": "2026-08-10T09:30:00Z"
      },
      {
        "product_public_id": "prd_01J6XK8Q3M2N5B7V9C4D1E0G",
        "variant_public_id": "var_01J6XK8Q3M2N5B7V9C4D1E0G",
        "product_name": "USB-C Fast Charger",
        "product_slug": "usb-c-fast-charger",
        "sku": "SW-UC-002-WHT",
        "color": "White",
        "size": null,
        "unit_price": "19.99",
        "discount_percentage": null,
        "quantity": 3,
        "total_amount": "59.97",
        "created_at": "2026-08-10T09:30:00Z"
      }
    ],
    "created_at": "2026-08-10T09:30:00Z",
    "updated_at": "2026-08-10T09:30:01Z"
  }
}
```

### Response Headers

> None.

---

## Processing Flow

1. Client sends the request with an authenticated session.
2. API validates the request body (`address_public_id`, `payment_method`, `coupon_code`, `notes`).
3. API acquires a **per-user advisory lock** (PostgreSQL `pg_advisory_xact_lock` on the session user's internal ID) so concurrent checkouts from the same user serialize; a second checkout that arrives after the first commits sees the consumed cart and is rejected (see **Business Rules**).
4. Inside one `prisma.$transaction`:
   a. API resolves the session user's cart; **404** when no cart exists, **409** when the cart is empty.
   b. API resolves the shipping address by `address_public_id` (must belong to the session user and not be soft-deleted); **404** otherwise.
   c. API validates every cart line: the variant must exist, not be soft-deleted, and have status `ACTIVE`; its product must exist and not be soft-deleted. **409** when any line is no longer purchasable.
   d. API recomputes live pricing for every line from the current variant values (`final_price` = price after `discount_percentage`, identical formula to the cart/product docs) — a price change between add and checkout is charged at checkout by design.
   e. API calls `reserveStock(variantInternalId, quantity)` for every line (locks each inventory row); **409** when `quantity_available` is insufficient for any line (the oversell guard).
   f. API applies the optional coupon (see **Business Rules**), computing `discount_amount` and recording `coupon_usages`.
   g. API computes `subtotal`, `shipping_fee`, `tax_amount`, and `total_amount` (see **Derived Fields**).
   h. API creates the `orders` row (`status = "pending"`, `placed_at`/`created_at` = now) and, in the same transaction, the `shipments` row (`status = "pending"`, carrier/tracking null) holding the immutable address snapshot copied from the selected `user_addresses` row; derives `order_number` from the inserted ID.
   i. API creates one `order_items` row per cart line with the snapshot values (product name/slug, SKU, color, size, `unit_price`, `discount_percentage`, `quantity`, `total_amount`).
   j. API processes the payment through the provider abstraction: the mock provider completes synchronously, producing `transaction_reference`, `paid_at`, and `payment_status = "paid"`; the `payments` row is linked to the order. On success the order transitions to `confirmed` and API calls `commitStock` for every line (decrements `quantity_on_hand`, releases the reservation). On failure the order stays `cancelled`, the payment records `failed`, and API calls `releaseStock` for every line (see **Notes**).
   k. API deletes the cart row and all of its lines (the cart is consumed; a subsequent `GET /api/v1/cart` returns **404** until the user adds items again).
5. API returns **201 Created** with the resulting Order Object.

---

## Business Rules

- Checkout consumes the session user's cart **only**; there is no request body cart payload.
- **No cart → 404** ("Cart not found for this user"); **empty cart → 409** ("The cart is empty").
- The address must be a saved address owned by the session user; free-form address input is not accepted (the address module is the single source of address data).
- Purchasability: every variant must exist, not be soft-deleted, and have status `ACTIVE`; the parent product must not be soft-deleted. Unavailable lines → **409**.
- Stock: `reserveStock` fails when `quantity_available` is insufficient → **409** (the documented oversell guard; see `docs/api/inventory/inventory.md`).
- Coupon validation (when `coupon_code` is provided): the coupon must exist and not be soft-deleted, be `is_active`, be within `starts_at`/`expires_at`, respect `usage_limit` and `usage_limit_per_user` (the session user's prior usage), and `subtotal` must meet `minimum_order_amount` when set. Any violation → **409**. The discount is `FIXED_AMOUNT` → capped at `maximum_discount_amount` when set and never below zero; `PERCENTAGE` → `round2(subtotal * discount_value / 100)`, capped at `maximum_discount_amount`. The coupon row's `usage_count` is incremented and a `coupon_usages` row is created in the same transaction.
- Prices are always recomputed live at checkout from the current variant values and then **frozen** into the order items (immutable snapshots).
- The mock payment always succeeds synchronously; the order is therefore created in the `confirmed` state with stock committed. `pending` remains the initial state for future asynchronous providers.
- Order placement is effectively idempotent for the customer: after a successful checkout the cart is gone, so a duplicate request is rejected (404/409) rather than double-charging. Parallel duplicate checkouts are serialized by the per-user advisory lock (see **Security Considerations** and **Design Decisions**).
- `coupon_usages.orders_id` is unique, so at most one coupon applies per order.
- **Coupon quota semantics on cancellation/refund:** cancelling an order **before fulfillment** (`pending/confirmed/processing → cancelled`) deletes its `coupon_usages` row and decrements the coupon's `usage_count` (never below zero), so the coupon can be reused. Refunding a **returned** order (`returned → refunded`) does **not** restore quota — the coupon stays consumed (see `docs/api/orders/orders-design-review.md` §2.3).

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid request body (e.g., unsupported `payment_method`, malformed `address_public_id`) |
| 401 Unauthorized | Missing or invalid session |
| 404 Not Found | No cart, or `address_public_id` does not exist / is soft-deleted / belongs to another user |
| 409 Conflict | Empty cart; line no longer purchasable; insufficient stock; coupon invalid or not applicable |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Endpoint is behind the shared `authentication` middleware.
- The cart and the address are always resolved from the session user; no user identifier is accepted from the client.
- A per-user advisory lock serializes concurrent checkouts, preventing double-orders from parallel submissions.
- Money fields are never accepted from the client; totals are computed server-side.
- Payment is processed through the provider abstraction; client-supplied payment values are limited to the allowed method enum.

---

## Notes

- This is the only customer write endpoint; order status changes belong to the administrator surface.
- The mock provider records a `mock_…` `transaction_reference`. Future providers (Stripe, Paymob, PayPal) implement the same gateway interface, and the checkout business logic does not change (see **Design Decisions**).
- `Idempotency-Key` header support (with a stored key column on `orders`) is a documented possible future hardening; v1 relies on cart consumption + the advisory lock.

---

# List Orders

## Overview

Returns the authenticated user's order history, newest first, with pagination and an optional status filter. Intended for the "My Orders" page.

---

## Endpoint

```http
GET /api/v1/orders
```

---

## Authentication

| Requirement | Value |
|-------------|-------|
| Authentication | Required |

---

## Authorization

Any authenticated user. Only the session user's own orders are returned.

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
| status | string | No | Filter by order status (e.g., `confirmed`, `shipped`, `delivered`, `cancelled`) |
| sort | string | No | Sort field with optional `-` prefix for descending. Allowed: `placed_at`, `order_number`, `total_amount`. Default: `-placed_at` (newest first) |

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
      "public_id": "ord_01J6XK8Q3M2N5B7V9C4D1E0F",
      "order_number": "ORD-00000042",
      "status": "confirmed",
      "placed_at": "2026-08-10T09:30:00Z",
      "subtotal": "293.95",
      "discount_amount": "20.00",
      "shipping_fee": "10.00",
      "tax_amount": "0.00",
      "total_amount": "283.95",
      "notes": "Please leave at the front desk.",
      "shipping_address": {
        "recipient_name": "Ahmed Hassan",
        "phone_number": "+201001234567",
        "country": "Egypt",
        "state": "Cairo Governorate",
        "city": "Cairo",
        "address_1": "12 Nile Street, Apt 5",
        "address_2": null,
        "postal_code": "11511"
      },
      "payment": {
        "public_id": "pay_01J6XK8Q3M2N5B7V9C4D1E0F",
        "status": "paid",
        "method": "mock",
        "provider": "mock",
        "transaction_reference": "mock_01J6XK8Q3M2N5B7V9C4D1E0F",
        "amount": "283.95",
        "paid_at": "2026-08-10T09:30:01Z"
      },
      "items": [
        {
          "product_public_id": "prd_01J6XK8Q3M2N5B7V9C4D1E0F",
          "variant_public_id": "var_01J6XK8Q3M2N5B7V9C4D1E0F",
          "product_name": "Wireless Noise-Cancelling Headphones",
          "product_slug": "wireless-noise-cancelling-headphones",
          "sku": "SW-HP-001-BLK-M",
          "color": "Black",
          "size": "M",
          "unit_price": "116.99",
          "discount_percentage": "10.00",
          "quantity": 2,
          "total_amount": "233.98",
          "created_at": "2026-08-10T09:30:00Z"
        },
        {
          "product_public_id": "prd_01J6XK8Q3M2N5B7V9C4D1E0G",
          "variant_public_id": "var_01J6XK8Q3M2N5B7V9C4D1E0G",
          "product_name": "USB-C Fast Charger",
          "product_slug": "usb-c-fast-charger",
          "sku": "SW-UC-002-WHT",
          "color": "White",
          "size": null,
          "unit_price": "19.99",
          "discount_percentage": null,
          "quantity": 3,
          "total_amount": "59.97",
          "created_at": "2026-08-10T09:30:00Z"
        }
      ],
      "created_at": "2026-08-10T09:30:00Z",
      "updated_at": "2026-08-10T09:30:01Z"
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
2. API validates query parameters (`page`, `limit`, `status`, `sort`).
3. API loads the session user's orders (hard filter on the session user's internal ID) with items, payment, and shipping-address snapshot.
4. API applies the `status` filter and the requested sorting.
5. API applies pagination and returns **200 OK** with the Order Object list and the standard `pagination` object.

---

## Business Rules

- Only the session user's orders are ever returned; there is no cross-user access.
- Orders are returned newest first by default (`-placed_at`).
- `status` must be one of the supported order statuses; an unknown value → 400.
- `sort` accepts only `placed_at`, `order_number`, and `total_amount`; a `-` prefix reverses order.
- Pagination uses 1-based `page` and clamps `limit` to a maximum of 100.
- Each row is the full Order Object (items included) so the history page can render without N+1 client requests; order history is a bounded personal collection.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid query parameters (e.g., unknown `status` or `sort` value) |
| 401 Unauthorized | Missing or invalid session |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Endpoint is behind the shared `authentication` middleware.
- The query is hard-filtered by the session user's internal ID.

---

## Notes

- An empty history returns `200 OK` with `data: []` and `total: 0`.
- Admin users see their own customer orders here; the full order surface is `GET /api/v1/admin/orders`.

---

# Get Order

## Overview

Returns a single order by public ID, with all items, the shipping-address snapshot, and the payment record. Intended for the order detail / confirmation page.

---

## Endpoint

```http
GET /api/v1/orders/{order_public_id}
```

---

## Authentication

| Requirement | Value |
|-------------|-------|
| Authentication | Required |

---

## Authorization

Any authenticated user. The order must belong to the session user; a foreign order is indistinguishable from a missing one (**404**, no leak).

---

## Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| Cookie | Yes | `session` cookie issued at login |

---

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| order_public_id | string | Yes | Public order identifier (`ord_…` prefix) |

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
    "public_id": "ord_01J6XK8Q3M2N5B7V9C4D1E0F",
    "order_number": "ORD-00000042",
    "status": "confirmed",
    "placed_at": "2026-08-10T09:30:00Z",
    "subtotal": "293.95",
    "discount_amount": "20.00",
    "shipping_fee": "10.00",
    "tax_amount": "0.00",
    "total_amount": "283.95",
    "notes": "Please leave at the front desk.",
    "shipping_address": {
      "recipient_name": "Ahmed Hassan",
      "phone_number": "+201001234567",
      "country": "Egypt",
      "state": "Cairo Governorate",
      "city": "Cairo",
      "address_1": "12 Nile Street, Apt 5",
      "address_2": null,
      "postal_code": "11511"
    },
    "payment": {
      "public_id": "pay_01J6XK8Q3M2N5B7V9C4D1E0F",
      "status": "paid",
      "method": "mock",
      "provider": "mock",
      "transaction_reference": "mock_01J6XK8Q3M2N5B7V9C4D1E0F",
      "amount": "283.95",
      "paid_at": "2026-08-10T09:30:01Z"
    },
    "items": [
      {
        "product_public_id": "prd_01J6XK8Q3M2N5B7V9C4D1E0F",
        "variant_public_id": "var_01J6XK8Q3M2N5B7V9C4D1E0F",
        "product_name": "Wireless Noise-Cancelling Headphones",
        "product_slug": "wireless-noise-cancelling-headphones",
        "sku": "SW-HP-001-BLK-M",
        "color": "Black",
        "size": "M",
        "unit_price": "116.99",
        "discount_percentage": "10.00",
        "quantity": 2,
        "total_amount": "233.98",
        "created_at": "2026-08-10T09:30:00Z"
      }
    ],
    "created_at": "2026-08-10T09:30:00Z",
    "updated_at": "2026-08-10T09:30:01Z"
  }
}
```

### Response Headers

> None.

---

## Processing Flow

1. Client sends the request with an authenticated session and the order public ID.
2. API validates the path parameter format.
3. API resolves the order by `public_id` **and** the session user's internal ID (ownership check).
4. API loads items, payment, and shipping-address snapshot.
5. API returns **200 OK** with the Order Object, or **404** when the order does not exist or belongs to another user.

---

## Business Rules

- An order the session user does not own returns **404** (never 403), so order existence is not leaked.
- The order, its items, and its totals are immutable; no live catalog data is joined into the response.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid `order_public_id` format |
| 401 Unauthorized | Missing or invalid session |
| 404 Not Found | Order does not exist or does not belong to the session user |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Endpoint is behind the shared `authentication` middleware.
- Ownership is enforced in the query itself (public ID + session user's internal ID), preventing enumeration of other users' orders.

---

## Notes

- The same Order Object shape is returned by `POST /api/v1/orders`, so the checkout response can be rendered directly as the confirmation page.

---

# Administrator Order Management

All endpoints require an authenticated session with the `admin` or `super_admin` role. They operate on every customer's orders. The surface matches the sketch in `docs/api/admin/admin.md`:

```
GET    /api/v1/admin/orders
GET    /api/v1/admin/orders/{order_public_id}
PATCH  /api/v1/admin/orders/{order_public_id}
```

# List Orders

## Overview

Returns a paginated list of every order in the system with search, status, and date-range filters, plus sorting. Intended for the admin order dashboard.

---

## Endpoint

```http
GET /api/v1/admin/orders
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
| status | string | No | Filter by order status (e.g., `pending`, `confirmed`, `shipped`) |
| search | string | No | Case-insensitive substring match against `order_number`, customer name, or customer email |
| placed_from | string | No | Inclusive lower bound on `placed_at` (ISO 8601 UTC) |
| placed_to | string | No | Inclusive upper bound on `placed_at` (ISO 8601 UTC) |
| sort | string | No | Sort field with optional `-` prefix for descending. Allowed: `placed_at`, `order_number`, `total_amount`, `customer_name`. Default: `-placed_at` (newest first) |

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
      "public_id": "ord_01J6XK8Q3M2N5B7V9C4D1E0F",
      "order_number": "ORD-00000042",
      "status": "confirmed",
      "placed_at": "2026-08-10T09:30:00Z",
      "subtotal": "293.95",
      "discount_amount": "20.00",
      "shipping_fee": "10.00",
      "tax_amount": "0.00",
      "total_amount": "283.95",
      "customer_public_id": "usr_01J6XK8Q3M2N5B7V9C4D1E0F",
      "customer_name": "Ahmed Hassan",
      "customer_email": "ahmed@example.com",
      "created_at": "2026-08-10T09:30:00Z",
      "updated_at": "2026-08-10T09:30:01Z"
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

1. Client sends the request with an authenticated admin session and optional query parameters.
2. API validates query parameters (`page`, `limit`, `status`, `search`, `placed_from`, `placed_to`, `sort`).
3. API joins `orders` to `users` (customer summary) and applies the `status`, `search`, and `placed_at` range filters.
4. API applies sorting and pagination.
5. API returns **200 OK** with the admin list rows and the standard `pagination` object.

---

## Business Rules

- The list is **not** scoped to a user: it spans all customers.
- `search` matches substrings in `order_number`, `customer_name`, or `customer_email` (case-insensitive).
- `placed_from`/`placed_to` are inclusive; `placed_from` > `placed_to` → 400.
- `sort` accepts only `placed_at`, `order_number`, `total_amount`, and `customer_name`; a `-` prefix reverses order.
- Pagination uses 1-based `page` and clamps `limit` to a maximum of 100.
- List rows are intentionally lighter than the full Order Object (no items/payment embedded); the detail endpoint returns the full projection.
- Derived/joined fields in list queries may require schema-qualified raw SQL per the inventory precedent (see `docs/api/inventory/inventory.md` — **Notes**).

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid query parameters (e.g., unknown `sort` field, `placed_from` > `placed_to`) |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated but not an admin / super admin |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Endpoint is behind the shared `authentication` + `authorization(user_role.ADMIN, user_role.SUPER_ADMIN)` middleware.
- Customer emails are only exposed to privileged roles.

---

## Notes

- An empty result set returns `200 OK` with `data: []` and `total: 0`.

---

# Get Order

## Overview

Returns a single order with the full administrator projection: the Order Object extended with the customer summary and the shipment record (created at checkout, holding the address snapshot).

---

## Endpoint

```http
GET /api/v1/admin/orders/{order_public_id}
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

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| order_public_id | string | Yes | Public order identifier (`ord_…` prefix) |

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
    "public_id": "ord_01J6XK8Q3M2N5B7V9C4D1E0F",
    "order_number": "ORD-00000042",
    "status": "shipped",
    "placed_at": "2026-08-10T09:30:00Z",
    "subtotal": "293.95",
    "discount_amount": "20.00",
    "shipping_fee": "10.00",
    "tax_amount": "0.00",
    "total_amount": "283.95",
    "notes": "Please leave at the front desk.",
    "shipping_address": {
      "recipient_name": "Ahmed Hassan",
      "phone_number": "+201001234567",
      "country": "Egypt",
      "state": "Cairo Governorate",
      "city": "Cairo",
      "address_1": "12 Nile Street, Apt 5",
      "address_2": null,
      "postal_code": "11511"
    },
    "payment": {
      "public_id": "pay_01J6XK8Q3M2N5B7V9C4D1E0F",
      "status": "paid",
      "method": "mock",
      "provider": "mock",
      "transaction_reference": "mock_01J6XK8Q3M2N5B7V9C4D1E0F",
      "amount": "283.95",
      "paid_at": "2026-08-10T09:30:01Z"
    },
    "shipment": {
      "public_id": "shp_01J6XK8Q3M2N5B7V9C4D1E0F",
      "status": "shipped",
      "carrier": "DHL",
      "tracking_number": "JD014600003301234567",
      "shipped_at": "2026-08-11T08:00:00Z",
      "delivered_at": null
    },
    "customer_public_id": "usr_01J6XK8Q3M2N5B7V9C4D1E0F",
    "customer_name": "Ahmed Hassan",
    "customer_email": "ahmed@example.com",
    "customer_phone_number": "+201001234567",
    "items": [
      {
        "product_public_id": "prd_01J6XK8Q3M2N5B7V9C4D1E0F",
        "variant_public_id": "var_01J6XK8Q3M2N5B7V9C4D1E0F",
        "product_name": "Wireless Noise-Cancelling Headphones",
        "product_slug": "wireless-noise-cancelling-headphones",
        "sku": "SW-HP-001-BLK-M",
        "color": "Black",
        "size": "M",
        "unit_price": "116.99",
        "discount_percentage": "10.00",
        "quantity": 2,
        "total_amount": "233.98",
        "created_at": "2026-08-10T09:30:00Z"
      }
    ],
    "created_at": "2026-08-10T09:30:00Z",
    "updated_at": "2026-08-11T08:00:00Z"
  }
}
```

### Response Headers

> None.

---

## Processing Flow

1. Client sends the request with an authenticated admin session and the order public ID.
2. API validates the path parameter format.
3. API resolves the order by `public_id` (any user's order).
4. API loads items, payment, shipment (which carries the address snapshot), and the customer summary.
5. API returns **200 OK** with the full administrator projection, or **404** when the order does not exist.

---

## Business Rules

- Unlike the customer detail endpoint, a missing order is a plain **404** (admin users are trusted with existence).
- The shipment object is present for every order — the `shipments` row is created at checkout (status `pending`) to hold the address snapshot — with fulfillment fields (`carrier`, `tracking_number`, `shipped_at`, `delivered_at`) null until the order ships.
- No live catalog or address data is joined into the response; everything shown is the order snapshot.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid `order_public_id` format |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated but not an admin / super admin |
| 404 Not Found | Order does not exist |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Endpoint is behind the shared `authentication` + `authorization(user_role.ADMIN, user_role.SUPER_ADMIN)` middleware.

---

## Notes

- The `shipment` object uses the existing `shipments` table (`shp_…` public prefix); no schema change was required — the row is created at checkout and updated through the status endpoint.

---

# Update Order Status

## Overview

Advances or terminates an order's lifecycle (confirm, process, ship, deliver, cancel, return, refund). Enforces the allowed-transition matrix and performs the associated side effects (shipment row creation, `shipped_at`/`delivered_at` timestamps, payment refund, stock release).

---

## Endpoint

```http
PATCH /api/v1/admin/orders/{order_public_id}
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

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| order_public_id | string | Yes | Public order identifier (`ord_…` prefix) |

---

## Query Parameters

> None.

---

## Request Body

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| status | string | Yes | Target status; must be a legal transition from the current status (see **Business Rules**) |
| carrier | string | No | Shipping carrier name; required when transitioning to `shipped`, max 100 characters |
| tracking_number | string | No | Carrier tracking number; accepted when transitioning to `shipped`, max 100 characters |

### Example

```json
{
  "status": "shipped",
  "carrier": "DHL",
  "tracking_number": "JD014600003301234567"
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
    "public_id": "ord_01J6XK8Q3M2N5B7V9C4D1E0F",
    "order_number": "ORD-00000042",
    "status": "shipped",
    "placed_at": "2026-08-10T09:30:00Z",
    "subtotal": "293.95",
    "discount_amount": "20.00",
    "shipping_fee": "10.00",
    "tax_amount": "0.00",
    "total_amount": "283.95",
    "notes": "Please leave at the front desk.",
    "shipping_address": {
      "recipient_name": "Ahmed Hassan",
      "phone_number": "+201001234567",
      "country": "Egypt",
      "state": "Cairo Governorate",
      "city": "Cairo",
      "address_1": "12 Nile Street, Apt 5",
      "address_2": null,
      "postal_code": "11511"
    },
    "payment": {
      "public_id": "pay_01J6XK8Q3M2N5B7V9C4D1E0F",
      "status": "paid",
      "method": "mock",
      "provider": "mock",
      "transaction_reference": "mock_01J6XK8Q3M2N5B7V9C4D1E0F",
      "amount": "283.95",
      "paid_at": "2026-08-10T09:30:01Z"
    },
    "shipment": {
      "public_id": "shp_01J6XK8Q3M2N5B7V9C4D1E0F",
      "status": "shipped",
      "carrier": "DHL",
      "tracking_number": "JD014600003301234567",
      "shipped_at": "2026-08-11T08:00:00Z",
      "delivered_at": null
    },
    "customer_public_id": "usr_01J6XK8Q3M2N5B7V9C4D1E0F",
    "customer_name": "Ahmed Hassan",
    "customer_email": "ahmed@example.com",
    "customer_phone_number": "+201001234567",
    "items": [
      {
        "product_public_id": "prd_01J6XK8Q3M2N5B7V9C4D1E0F",
        "variant_public_id": "var_01J6XK8Q3M2N5B7V9C4D1E0F",
        "product_name": "Wireless Noise-Cancelling Headphones",
        "product_slug": "wireless-noise-cancelling-headphones",
        "sku": "SW-HP-001-BLK-M",
        "color": "Black",
        "size": "M",
        "unit_price": "116.99",
        "discount_percentage": "10.00",
        "quantity": 2,
        "total_amount": "233.98",
        "created_at": "2026-08-10T09:30:00Z"
      }
    ],
    "created_at": "2026-08-10T09:30:00Z",
    "updated_at": "2026-08-11T08:00:00Z"
  }
}
```

### Response Headers

> None.

---

## Processing Flow

1. Client sends the request with an authenticated admin session, the order public ID, and the target status.
2. API validates the path parameter and request body (`status`, `carrier`, `tracking_number`).
3. API resolves the order by `public_id`; **404** when missing.
4. API validates the transition against the allowed-transition matrix; an illegal transition → **409** (current status conflicts with the requested status).
5. Inside one `prisma.$transaction`, API applies the transition and its side effects:
   - `pending → confirmed` — marks the payment `paid` (retroactive confirmation for a deferred-provider order) and calls `commitStock` for every line.
   - `pending → cancelled` — calls `releaseStock` for every line (reservation returned; no committed stock exists yet, so nothing is restocked).
   - `confirmed|processing → cancelled` — a paid payment is marked `refunded` and `restockStock` is called for every line, restoring the committed quantities to `quantity_on_hand` (audit reason `order_cancel`).
   - `confirmed → processing` — no side effects.
   - `processing → shipped` — updates the checkout-created `shipments` row (`status = "shipped"`, `carrier`, `tracking_number`, `shipped_at` = now); `carrier` is required.
   - `shipped → delivered` — updates the shipment row (`status = "delivered"`, `delivered_at` = now).
   - `delivered → returned` — no side effects.
   - `returned → refunded` — marks the payment `refunded` and calls `restockStock` for every line, restoring the returned quantities (audit reason `order_refund`).
   - Any transition to a state with a paid payment and an unreleased reservation performs the appropriate stock side effect.
6. API updates `orders.updated_at` and returns **200 OK** with the full administrator projection.

---

## Business Rules

- The allowed transitions are exactly:

| From | To |
| --- | --- |
| `pending` | `confirmed`, `cancelled` |
| `confirmed` | `processing`, `cancelled` |
| `processing` | `shipped`, `cancelled` |
| `shipped` | `delivered` |
| `delivered` | `returned` |
| `returned` | `refunded` |
| `cancelled`, `refunded` | *(terminal)* |

- Illegal, backwards, or skipped transitions (e.g., `confirmed → shipped`, `delivered → processing`, `shipped → cancelled`) → **409**.
- An order can be cancelled from `confirmed`/`processing`; because v1 charges at checkout, cancelling a paid order refunds the payment (payment status → `refunded`) **and auto-restocks** the committed quantities: `restockStock` increments `quantity_on_hand` by each line's quantity inside the same status-transition transaction, so operators never need a manual inventory adjustment.
- Refunding a **returned** order (`returned → refunded`) also auto-restocks the returned quantities (`restockStock` per line, audit reason `order_refund`). v1 always restocks full line quantities on refund — partial returns and destroyed/damaged-return handling are future enhancements.
- Transitioning to `shipped` requires `carrier`; `tracking_number` is optional.
- The same status re-applied (no-op) → **409** (the order is already in that state).
- `orders.updated_at` is refreshed on every successful transition; `placed_at` is immutable.
- Status changes are audit-logged via the structured logger (actor ID, order public ID, from status, to status) — mirroring the admin users/inventory precedent; no audit table exists (documented future enhancement).

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid body (e.g., missing `carrier` when shipping, unknown status value) |
| 401 Unauthorized | Missing or invalid session |
| 403 Forbidden | Authenticated but not an admin / super admin |
| 404 Not Found | Order does not exist |
| 409 Conflict | Illegal transition, no-op transition, or state conflict |
| 500 Internal Server Error | Unexpected server error |

---

## Security Considerations

- Endpoint is behind the shared `authentication` + `authorization(user_role.ADMIN, user_role.SUPER_ADMIN)` middleware.
- `carrier`/`tracking_number` are treated as untrusted input (length-limited, validated); they are only ever written to the `shipments` row.
- Stock and payment side effects are transactional; a failed transition cannot partially apply.

---

## Notes

- There is no customer-facing cancellation endpoint in v1 (the requirements define checkout, history, and details for customers); cancellation and refunds are administrator actions. A customer cancel endpoint (`POST /api/v1/orders/{order_public_id}/cancel`) with a cancellation window is a documented possible future enhancement.
- Cancelling a committed order (`confirmed|processing → cancelled`) and refunding a returned order (`returned → refunded`) both **auto-restock** committed stock via the `restockStock` order operation (see `docs/api/inventory/inventory.md`); the reason (`order_cancel` / `order_refund`) is audit-logged per line.

---

# Schema Changes Required

The current schema cannot fully serve the **immutable snapshot** requirements, and the existing documentation already claimed behavior the schema did not store (see the conflict note below). Three minimal, backward-compatible schema changes were required before implementation; the API contract in this document assumes they exist. All three are now in place: changes 1 and 3 are applied in `prisma/schema.prisma`, and change 2 is satisfied without a schema change by creating the `shipments` row at checkout (see section 2).

## 1. `order_items` — snapshot columns (applied)

The Order Item requirement ("product name, variant, SKU, quantity, unit price, discount, subtotal") and the Order Items requirement ("Historical order data must never change when products are edited") require storing the product context at checkout. The applied schema adds the snapshot columns below — wider than the original proposal (`sku`/`variant_color`/`variant_size` are `VARCHAR(100)` and the variant dimensions are snapshotted too):

| Column | Type | Notes |
| --- | --- | --- |
| product_name | `VARCHAR(255)` NOT NULL | Snapshot of `products.name` at checkout |
| product_slug | `VARCHAR(255)` NOT NULL | Snapshot of `products.slug` at checkout |
| sku | `VARCHAR(100)` NOT NULL | Snapshot of `product_variants.sku` at checkout |
| variant_color | `VARCHAR(100)` NULL | Snapshot of `product_variants.color` |
| variant_size | `VARCHAR(100)` NULL | Snapshot of `product_variants.size` |
| variant_weight | `DECIMAL(10,2)` NULL | Snapshot of `product_variants.weight` |
| variant_width | `DECIMAL(10,2)` NULL | Snapshot of `product_variants.width` |
| variant_length | `DECIMAL(10,2)` NULL | Snapshot of `product_variants.length` |
| variant_height | `DECIMAL(10,2)` NULL | Snapshot of `product_variants.height` |
| discount_percentage | `DECIMAL(5,2)` NULL | Snapshot of `product_variants.discount_percentage` |

`unit_price` and `total_amount` already exist and store the price snapshot. `deleted_at` stays (schema parity; never set, never exposed).

## 2. `orders` — shipping-address snapshot (implemented via `shipments`, resolved)

The Addresses API and `docs/DATABASE.md` both promise that "Orders copy address data into immutable snapshots at checkout," but `orders` only stores `user_addresses_id` (a live FK). The original proposal added one JSONB column:

| Column | Type | Notes |
| --- | --- | --- |
| shipping_address_snapshot | `JSONB` NOT NULL | Full copy of the selected `user_addresses` row at checkout (recipient_name, phone_number, country, state, city, address_1, address_2, zip_code) |

**Resolution (no schema change):** the applied schema stores the snapshot as individual columns on `shipments` (`recipient_name`, `phone_number`, `country`, `state`, `city`, `address_1`, `address_2`, `postal_code`). The `shipments` row is created **at checkout** in the same transaction as the order (`status = "pending"`, carrier/tracking null), so the immutable snapshot exists from the moment the order is placed and the Order Object's `shipping_address` always derives from it. `orders.user_addresses_id` stays as the provenance FK; `processing → shipped` later updates the existing row (carrier, tracking, `status = "shipped"`, `shipped_at`) instead of creating it. The **Shipping Address Object** mirrors the `shipments` snapshot columns (`postal_code` maps `user_addresses.zip_code`).

## 3. `payments` — public key, order link, status enum (applied)

Orders must expose payment information, and the Payments requirement records provider, reference, amount, and timestamps. The applied schema links `payments` to `orders` 1:1, adds a public key, and switches status to the `payment_status` enum:

| Column | Type | Notes |
| --- | --- | --- |
| public_id | `VARCHAR(50)` NOT NULL UNIQUE | `pay_…` prefix (already in `PUBLIC_ID_PREFIXES`) |
| orders_id | `INT` NOT NULL UNIQUE + FK `fk_payments_orders` | Links the payment to its order (1:1 via `payments__unique_key`); unlike the original proposal it is NOT nullable — v1 has no standalone payment records |
| status | `payment_status` | Enum: `PENDING`, `AUTHORIZED`, `PAID`, `FAILED`, `REFUNDED` (replaces the old `VARCHAR(30)` column) |
| failed_at | `TIMESTAMPTZ` NULL | Timestamp the payment failed |
| refunded_at | `TIMESTAMPTZ` NULL | Timestamp the payment was refunded |

`transaction_reference` is now UNIQUE; new indexes: `idx_payments_order_id`, `idx_payments_paid_at`, `idx_payments_public_id`, `idx_payments_status`, `idx_payments_transaction_reference`.

`payment_method` stores `mock` for v1; a `payment_provider` column can be added when a second provider ships, or `payment_method` can continue to carry the provider name (see **Design Decisions**).

## Conflict note

`docs/DATABASE.md` (order_items, orders descriptions) and `docs/api/users/addresses.md` describe immutable snapshots that the schema columns did not store. Per project convention, the conflict is reported here rather than silently resolved. All three changes are now in place: change 1 (order_items snapshots) and change 3 (payments) are applied in `prisma/schema.prisma`, and change 2 is satisfied without a schema change by the `shipments` row created at checkout holding the address snapshot. Documentation and implementation now agree.

---

# Error Responses

| Status | Reason |
|--------|--------|
| 400 Bad Request | Invalid request body or query/path parameter |
| 401 Unauthorized | Authentication required |
| 403 Forbidden | Authenticated but not an admin / super admin |
| 404 Not Found | No cart, address not found, order not found (customer: including orders of other users) |
| 409 Conflict | Empty cart, line no longer purchasable, insufficient stock, coupon not applicable, illegal order-status transition |
| 500 Internal Server Error | Unexpected server error |

Error responses use the shared project format:

```json
{
  "success": false,
  "message": "Order ord_01J6XK8Q3M2N5B7V9C4D1E0F cannot transition from confirmed to shipped."
}
```

---

# Notes

- Internal database IDs are never exposed; orders use `ord_…`, payments `pay_…`, shipments `shp_…`, and order items reference the purchased variant's `var_…` public ID.
- Timestamps are ISO 8601 UTC.
- Money values are decimal strings with 2 places; server-side arithmetic is decimal-based (never floating point).
- Order items, totals, the shipping-address snapshot, and the payment record are **immutable** once the order is placed; the only mutable order field is `status` (admin transitions) and `updated_at`.
- Checkout consumes the customer's cart (deletes the cart row and its lines in the checkout transaction); `GET /api/v1/cart` returns 404 until the user adds items again.
- Stock is reserved and committed through the Inventory API's transactional order operations (`reserveStock`/`commitStock`/`releaseStock` — see `docs/api/inventory/inventory.md`); the admin `PATCH /api/v1/admin/inventory` oversell guard shares the same invariants.
- The mock payment provider is synchronous and always succeeds. Provider-agnostic design keeps checkout business logic unchanged when Stripe/Paymob/PayPal are added.
- Coupons are validated and applied at checkout, but there is **no coupon management API** in v1; coupon rows are provisioned out-of-band (DB seed). A coupon admin surface is future work.
- List endpoints that join or filter by derived/joined fields may require schema-qualified raw SQL per the inventory precedent (Prisma 7's `PrismaPg` adapter qualifies generated queries only).
- The `ORDER_STATUS` constants file now includes `returned` (matching the schema enum).
- The `PUBLIC_ID_PREFIXES` constants file now includes `SHIPMENT: "shp"` (the `shipments` table has a `public_id` column).
- Customer orders are not paginated per item: the full item list is always embedded in the Order Object.

---

# Design Decisions

- **Checkout consumes the cart, transactionally** — `POST /api/v1/orders` is the single entry point into the order lifecycle. It reads the session user's cart (not a client-supplied payload), so the request cannot diverge from what the customer actually added, and the cart is deleted in the same transaction, making duplicate submissions impossible to double-charge. This mirrors the cart's "lazily created, consumed at checkout" lifecycle.
- **Per-user advisory lock serializes checkout** — The same PostgreSQL `pg_advisory_xact_lock` pattern the cart module uses on add is applied to checkout. Two parallel checkouts from one user serialize: the second sees the consumed cart and gets 409. A stored `Idempotency-Key` (with an `orders.idempotency_key` column) is documented as future hardening; v1's cart-consumption backstop is simpler and covers the customer-facing cases.
- **Immutable snapshots require schema changes** — The requirements explicitly demand that "historical order data must never change when products are edited" and that orders contain shipping and payment information. The current schema stores only the price snapshot and a live address FK, and `payments` is not linked to orders. The three changes in **Schema Changes Required** are the minimal set that makes the documented invariants true; this is the first module that cannot honestly be served schema-as-is, so the conflict is flagged explicitly instead of silently designing around it.
- **Order items keyed by `variant_public_id`, embedded, no item endpoint** — `order_items` has no `public_id` column and the requirements need no per-item operations (no reorder, no per-item refund in v1), so items are embedded in the Order Object and reference the purchased variant's public ID. Adding an `order_items.public_id` column was considered and rejected: a migration and a new prefix for no access-path benefit (same reasoning as inventory/cart keying decisions). `oit_…` stays reserved.
- **Prices are live at checkout, then frozen** — Consistent with the cart's live-pricing contract ("a price change between add and checkout is picked up automatically and charged at checkout"), checkout recomputes `final_price` from the current variant values and snapshots it into `order_items.unit_price`/`total_amount` plus the new snapshot columns. The order never re-reads catalog prices afterward.
- **Mock payment via a provider abstraction** — The Payments requirement mandates provider-agnostic design (Stripe/Paymob/PayPal later without business-logic changes). Checkout depends on a `PaymentGateway` interface (`process(amount, method)`); v1 implements the synchronous mock provider, which always succeeds and records a `mock_…` reference. Because the mock succeeds inline, v1 orders are created directly in `confirmed` with stock committed; `pending` remains for future asynchronous providers.
- **Order status machine is admin-driven after placement** — Customers get checkout/history/detail only (the exact requirements); every status change (confirm, process, ship, deliver, cancel, return, refund) goes through `PATCH /api/v1/admin/orders/{order_public_id}` with an explicit transition matrix and 409 for illegal transitions. A customer cancel endpoint with a cancellation window is a possible future enhancement.
- **Shipment row created at checkout; status endpoint updates it** — The `shipments` row is created with the order at checkout (`status = "pending"`, carrier/tracking null) purely to hold the immutable address snapshot. `processing → shipped` updates that row (carrier required, tracking optional, `status = "shipped"`, `shipped_at`) and `shipped → delivered` stamps `delivered_at`. No separate shipment endpoint is needed for v1; tracking updates can reuse this PATCH later.
- **409 for state conflicts, 400 for validation** — Matching the inventory precedent (oversell = 409), checkout failures that depend on current state (empty cart, unpurchasable line, insufficient stock, inapplicable coupon) and illegal status transitions are 409; malformed input stays 400. The customer detail endpoint returns 404 for other users' orders (never 403) to avoid leaking order existence.
- **Coupon support at checkout** — The `coupons`/`coupon_usages` tables exist and the requirements mention discounts, so checkout accepts an optional `coupon_code` and validates it transactionally (active, in window, usage limits, minimum order) against the schema columns. Coupon **management** (admin CRUD) is out of scope; rows are seeded out-of-band.
- **Order number derived from the internal ID** — `order_number = "ORD-" + zero-padded id` is unique by construction (the auto-increment ID is unique), avoids a separate sequence, and is stable forever since order rows are immutable and never deleted.
- **Flat shipping fee with free-shipping threshold** — No shipping-rate engine exists in v1, so the fee is a server-side constant pair (`FLAT_SHIPPING_FEE`, `FREE_SHIPPING_THRESHOLD`) with the total computed as documented. Clients can never supply a shipping fee. Both `orders.shipping_cost` and `orders.shipping_fee` are populated identically (schema duplicates; `shipping_fee` is canonical in the contract). A rate engine can replace the constants without a contract change.
- **Tax is a zero placeholder** — The schema has `tax_amount` and the totals formula includes it, but no tax engine is in scope; v1 stores `"0.00"`. The contract already carries the field, so a future tax engine is non-breaking.
- **Admin list rows are lighter than the detail projection** — The dashboard list embeds no items/payment (only customer summary + totals), keeping page payloads small; the detail endpoint returns the full projection. This mirrors the inventory list-vs-detail split.
- **Address snapshot columns on `shipments` (applied)** — The original proposal favored a single `orders.shipping_address_snapshot` JSONB column (self-describing, typed via zod); the applied schema instead uses individual snapshot columns on `shipments` (`recipient_name`…`postal_code`), with `orders.user_addresses_id` retained as the provenance FK. The `shipments` row is created at checkout (`status = "pending"`) so the snapshot exists for every order, and the Order Object's `shipping_address` mirrors these columns (`postal_code` maps `user_addresses.zip_code`).
