# T-019 — Scope `markPaymentRefunded` to `PAID` only

| Field | Value |
|-------|-------|
| **ID** | T-019 |
| **Priority** | P2 |
| **Status** | todo |
| **Type** | `bugfix` |
| **Branch** | `bugfix/payment-refund-status-guard` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

`markPaymentRefunded` updates payment regardless of current status. Correct in v1 (always PAID at refund time) but would mis-handle `FAILED`/`PENDING` if those appear with real gateways.

## Goal

Only transition `PAID → REFUNDED`; 0 rows → conflict/error.

## Scope

- Guarded update + affected-row check (pairs well with T-007).
- Tests for wrong prior status.
- Design-review minor item closed.

## Acceptance criteria

- [ ] Non-PAID payments cannot be marked refunded.
- [ ] Tests green.

## References

- `docs/api/orders/orders-design-review.md` §3
