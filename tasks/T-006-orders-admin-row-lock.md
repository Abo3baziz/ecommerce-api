# T-006 — Orders §2.4 — Row-lock admin status transitions

| Field | Value |
|-------|-------|
| **ID** | T-006 |
| **Priority** | P1 |
| **Status** | done |
| **Type** | `bugfix` |
| **Branch** | `bugfix/orders-admin-row-lock` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

`updateOrderStatus` reads the order, validates the transition matrix, then updates in a **second** transaction. Two concurrent admins can both read the same status and both proceed (e.g. both `CONFIRMED → SHIPPED`). Side effects are mostly idempotent, but the "same status → 409" check is racy.

## Goal

Make matrix check + side effects + status update atomic under a row lock.

## Scope

- `SELECT … FOR UPDATE` (schema-qualified raw SQL) or re-read inside the same `$transaction` before validating transitions.
- Keep existing side effects (stock, payment, shipment).
- Integration test for concurrent transitions if practical; at minimum prove lock path via single-threaded race simulation or transaction ordering.
- Mark §2.4 resolved in `docs/api/orders/orders-design-review.md`.

## Acceptance criteria

- [x] Transition validation and update share one locked transaction.
- [x] Concurrent illegal double-transition cannot both succeed.
- [x] Design review §2.4 marked resolved.
- [x] Tests green.

## References

- `docs/api/orders/orders-design-review.md` §2.4
- `src/modules/orders/service/admin.service.ts`
