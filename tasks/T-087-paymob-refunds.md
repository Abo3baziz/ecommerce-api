# T-087 — Paymob refunds (admin refund transition)

| Field | Value |
|-------|-------|
| **ID** | T-087 |
| **Priority** | P0 |
| **Status** | wontfix |
| **Type** | `feature` |
| **Branch** | `feature/paymob-refunds` |
| **Depends on** | T-083, T-085 |
| **Blocks** | — |

## Problem

The admin `refunded` order transition currently marks the payment refunded in
the database only — real money is never returned to the customer. With a real
gateway, refunding must move money through Paymob and only then update local
state.

## Goal

When an admin transitions a paid Paymob order to `refunded`, call
`paymobClient.refund(transactionId, amountCents)` first; on gateway success
mark the payment refunded (`refunded_at`); on gateway refusal return a
conflict so local state is never marked refunded without the money moving.

## Scope

- Refund trigger points in `admin.service.ts`:
  - `returned → refunded` (post-fulfillment refund) and
    `confirmed/processing → refunded` if allowed by the transition matrix —
    align with the matrix in `docs/api/orders/orders.md`.
  - Only when `payment.provider === "paymob"` and payment is `PAID` and
    `transaction_reference` exists. Otherwise keep the current local-only
    behavior (mock path unchanged).
- Flow:
  1. `paymobClient.refund(transaction_reference, amount × 100)`.
  2. On success → existing `markPaymentRefunded` + restock (unchanged).
  3. On gateway refusal/error → `ConflictError` (409) with provider message;
     no local state change.
- Idempotency: if payment already `refunded` → no-op success (guard from
  T-019 stays valid).
- Docs: refund note in `docs/api/orders/orders.md` + `docs/api/payments/…`.
- Tests (mocked client):
  - Refund success → payment refunded + restock.
  - Refund refused → 409, payment stays paid.
  - Mock-provider refund still local-only.
  - Refund on already-refunded payment → idempotent no-op.

## Out of scope

- Kiosk/BNPL refund caveats (not enabled in v1).
- Partial refunds UI.

## Acceptance criteria

- [ ] Paymob refunds actually move money (sandbox-verified once keys exist).
- [ ] Gateway refusal never leaves a locally-refunded payment.
- [ ] Mock refund path unchanged.
- [ ] Docs + tests green.

## References

- T-019 (payment refund status guard)
- T-083 (`PaymobClient.refund`)
- `src/modules/orders/service/admin.service.ts`
- Skill: `references/advanced-features.md` (refunds section)