# T-085 — Paymob webhook + HMAC verification

| Field | Value |
|-------|-------|
| **ID** | T-085 |
| **Priority** | P0 |
| **Status** | wontfix |
| **Type** | `feature` |
| **Branch** | `feature/paymob-webhook` |
| **Depends on** | T-084 |
| **Blocks** | T-086 |

## Problem

The redirect URL alone is not authenticated — only the Paymob callback is the
source of truth for payment status. The API must verify the HMAC signature
before trusting any webhook, apply the payment outcome atomically, and stay
idempotent so duplicate events never double-apply side effects.

## Goal

Implement `POST /api/v1/payments/webhooks/paymob` (public, server-to-server)
that verifies the SHA-512 HMAC per the skill's field-order spec, then
transitions the matching pending order to `confirmed` (commit stock, mark
paid) or ignores non-terminal/failed events. Failed/expired handling belongs
to the TTL job (T-086).

## Scope

- HMAC helper `src/modules/payments/service/hmac.ts`:
  `computePaymobHmac(secret, fields)` — SHA-512 over the ordered concatenation
  defined in `references/hmac-verification.md` (POST shape uses `obj.id` /
  `obj.order.id`; card-shaped `source_data.pan/sub_type/type` included when
  present). Constant-time comparison.
- Route `POST /payments/webhooks/paymob` mounted under `/api/v1`:
  - Public: no `authentication` middleware (HMAC is the auth). CSRF
    middleware already skips requests without a session cookie.
  - 401 on HMAC mismatch; log structured warning (no payload echo).
- Extract shared `confirmPendingOrder(orderId, transactionReference, tx)`
  from the admin `PENDING → CONFIRMED` case (mark payment PAID with
  `transaction_reference` + `paid_at`, commit stock per line, order →
  `confirmed`). Reuse from both admin service and webhook.
- Success event flow:
  - Find payment by `provider_intention_id` (intention id from payload
    `obj.id` → correlation via `special_reference` = order public id).
  - If already PAID/confirmed → 200 no-op (idempotent; unique
    `transaction_reference` is the backstop).
  - Else run `confirmPendingOrder` in one transaction; return 200.
- Non-success events (failed/cancelled/refunded): v1 logs and ignores —
  customer can retry within the same intention; abandonment handled by T-086.
- Body parsing: the HMAC covers ordered field concatenation, not the raw
  body, so the global `express.json()` parse is fine — extract fields from
  the parsed object.
- Docs: new `docs/api/payments/paymob-webhook.md` (signature format, event
  mapping, idempotency, retry behavior) + Apidog notes.
- Tests:
  - HMAC unit vectors from the skill reference (valid + tampered).
  - Webhook e2e: valid success → pending→confirmed + stock committed +
    `transaction_reference` stored; duplicate delivery → 200 no-op, single
    commit; invalid signature → 401, nothing changes; unknown intention → 404.

## Out of scope

- Transaction Inquiry fallback (T-086).
- Failed-event state handling (T-086).
- Disputes/chargebacks.

## Acceptance criteria

- [ ] Forged webhooks rejected (401).
- [ ] Duplicate events never double-commit stock.
- [ ] Successful webhook confirms order + commits stock exactly once.
- [ ] Admin `PENDING → CONFIRMED` path still works after refactor.
- [ ] Docs + tests green.

## References

- T-003 (umbrella: payment webhooks + reconciliation)
- T-084 (pending orders to confirm)
- `src/modules/orders/service/admin.service.ts` (CONFIRMED case)
- Skill: `references/hmac-verification.md`, `references/code-nodejs.md`