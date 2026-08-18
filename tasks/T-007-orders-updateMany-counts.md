# T-007 — Orders §2.5 — Check `updateMany` affected-row counts

| Field | Value |
|-------|-------|
| **ID** | T-007 |
| **Priority** | P1 |
| **Status** | done |
| **Type** | `bugfix` |
| **Branch** | `bugfix/orders-updateMany-counts` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

`markPaymentPaid` (requires `status = PENDING`) and `commitStock` (requires reserved ≥ qty) never check affected-row counts. A mismatched precondition can **silently succeed** with 0 rows updated.

## Goal

Treat 0 affected rows as a conflict/error inside the transaction and abort.

## Scope

- After each guarded `updateMany` / raw update, assert `count > 0` (or expected count).
- Map failures to `ConflictError` (or appropriate domain error) so the transaction rolls back.
- Same pattern for other silent guards if found in the same module.
- Tests for the failure path.
- Mark §2.5 resolved in the design review.

## Acceptance criteria

- [x] 0-row payment/stock updates throw and roll back.
- [x] Happy paths unchanged.
- [x] §2.5 resolved in docs.
- [x] Tests green.

## References

- `docs/api/orders/orders-design-review.md` §2.5
- `src/modules/orders/repository/orders.repository.ts`
