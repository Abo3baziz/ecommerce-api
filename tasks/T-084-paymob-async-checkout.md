# T-084 — Async checkout split (Paymob pending orders)

| Field | Value |
|-------|-------|
| **ID** | T-084 |
| **Priority** | P0 |
| **Status** | wontfix |
| **Type** | `feature` |
| **Branch** | `feature/paymob-async-checkout` |
| **Depends on** | T-082, T-083 |
| **Blocks** | T-085, T-086 |

## Problem

Checkout is synchronous: mock payment succeeds inline, orders are created
`confirmed`, stock is committed in the same transaction. A real gateway needs
the order to exist in `pending` first, with stock reserved (not committed),
and the customer redirected to Unified Checkout before any money moves.

## Goal

Split `placeOrder` so the `paymob` method creates a `pending` order + pending
payment, reserves stock, clears the cart, creates the intention via the
Paymob client, and returns a redirect URL to the frontend. The mock path
stays unchanged.

## Scope

- Validator: `payment_method: z.enum(["mock", "paymob"])` (replaces
  `z.literal("mock")` in `src/modules/orders/validators/orders.ts`).
- `placeOrder` paymob branch (inside the existing single transaction):
  - Same cart validation, items snapshot, coupon usage, shipment snapshot,
    order creation, `reserveStock`, order number.
  - Skip `commitStock`; order stays `order_status.PENDING`.
  - Create payment row: `status: PENDING`, `provider: "paymob"`,
    `payment_method: "paymob"`, no `transaction_reference` yet.
  - Clear cart as today (order owns the item snapshot).
- After the transaction commits, call
  `paymobClient.createIntention(...)` with order + shipment + items:
  - Store returned `intention_id` on the payment row (`provider_intention_id`).
  - On intention failure: compensating transaction → `releaseStock` per line,
    `restoreCouponUsage`, order → `CANCELLED`, payment → `FAILED`
    (`failed_at` set); surface a 502 `BadGatewayError("Payment provider is
    temporarily unavailable")` to the customer.
- Response shape: for paymob return `{ …order, checkout: { redirect_url } }`
  where `redirect_url = {base}/unifiedcheckout/?publicKey={PUBLIC_KEY}&clientSecret={client_secret}`
  (base per region from the skill's intention reference).
- `payment_method: "paymob"` while `!isPaymobConfigured()` → 503 (from T-081).
- Docs: `docs/api/orders/orders.md` checkout section (new pending flow,
  response shape, 502/503 errors).
- Tests (mocked client):
  - Paymob happy path: order pending, payment pending + intention stored,
    cart cleared, stock reserved-not-committed, redirect URL shape.
  - Intention failure: compensating cancel, stock released, coupon restored,
    502 returned.
  - Unconfigured → 503. Mock path regression: still `confirmed` inline.

## Out of scope

- Webhook confirmation (T-085).
- Expiry of abandoned pending orders (T-086).

## Acceptance criteria

- [ ] `payment_method: "paymob"` returns a pending order + redirect URL.
- [ ] No stock committed until webhook confirmation.
- [ ] Intention failure leaves no stuck order/stock leak.
- [ ] Mock path behavior unchanged.
- [ ] Docs + tests green.

## References

- T-002 (decision: Paymob; keep mock available)
- T-083 (`PaymobClient.createIntention`)
- `src/modules/orders/service/orders.service.ts`
- `src/modules/orders/validators/orders.ts`
- Skill: `references/intention-api.md`, `references/code-frontend.md`