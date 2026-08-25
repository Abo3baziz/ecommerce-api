# T-086 — Pending-order expiry + transaction inquiry

| Field | Value |
|-------|-------|
| **ID** | T-086 |
| **Priority** | P0 |
| **Status** | wontfix |
| **Type** | `feature` |
| **Branch** | `feature/paymob-expiry-reconciliation` |
| **Depends on** | T-084, T-085 |
| **Blocks** | — |

## Problem

Abandoned Paymob checkouts leave orders `pending` with reserved stock held
indefinitely, and a missed webhook (network, provider hiccup) would strand a
paid order at `pending`. Both need a pull-based fallback.

## Goal

Add a scheduled sweep that cancels stale `pending` Paymob orders (release
stock, restore coupon usage) after `PAYMOB_ORDER_TTL_MINUTES`, and an inquiry
path that pulls a transaction's real status from Paymob and applies it.

## Scope

- Expiry sweep (script like `scripts/cleanup-sessions.ts`,
  `sweep-stale-paymob-orders.ts`):
  - Select payments where `provider='paymob'` and `status=PENDING` and
    `orders.placed_at < now - TTL`.
  - Prefer inquiry (below) before cancelling: if inquiry says paid → confirm;
    if failed → cancel; if still pending → cancel (dead intention).
  - Cancel path: `releaseStock` per line + `restoreCouponUsage` + order →
    `CANCELLED` + payment → `FAILED` (`failed_at`) — reuse admin transition
    logic as a shared `cancelPendingOrder()`.
- Inquiry fallback:
  - `paymobClient.inquiryTransactionByMerchantOrderId(specialReference)`
    (T-083) keyed by `provider_intention_id`.
  - Expose `GET /orders/{order_public_id}/payment-status` (customer, authed):
    if payment pending and order older than a small grace (e.g. 30s), run
    inquiry, apply terminal result if any, return
    `{ order_status, payment_status }`.
  - Frontend polls this from `/checkout/result` (frontend T19).
- Docs: `docs/api/orders/orders.md` + `docs/api/payments/paymob-webhook.md`
  (reconciliation note).
- Tests (mocked client):
  - Sweep cancels stale pending order, releases stock, restores coupon.
  - Sweep confirms an order whose inquiry says paid.
  - Inquiry endpoint: fresh pending → no inquiry; stale pending + paid →
    confirmed; stale + failed → cancelled; unknown → 404.

## Out of scope

- Full reconciliation reporting/alerting dashboards.
- Retry queues for webhook delivery (Paymob retries are relied upon + inquiry
  is the backstop).

## Acceptance criteria

- [ ] Stale pending orders never hold stock forever.
- [ ] Inquiry applies terminal payment results idempotently.
- [ ] Customer endpoint documented + testable.
- [ ] Docs + tests green.

## References

- T-003 (umbrella)
- T-083 (inquiry client), T-085 (confirm path)
- `src/modules/orders/service/admin.service.ts` (CANCELLED case)
- Skill: `references/transaction-inquiry.md`