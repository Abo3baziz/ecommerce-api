# T-014 — Audit-log order placement

| Field | Value |
|-------|-------|
| **ID** | T-014 |
| **Priority** | P2 |
| **Status** | todo |
| **Type** | `chore` |
| **Branch** | `chore/checkout-audit-log` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

Admin status changes are structured-logged; **order placement** (the most important commercial event) is not audit-logged the same way.

## Goal

Emit a structured `logger.info` on successful checkout with actor, order public id, totals, and payment reference (no secrets).

## Scope

- Add log in `placeOrder` success path.
- Fields: `actorId`, `orderPublicId`, `totalAmount`, `paymentPublicId` (or similar).
- No PII beyond what existing logs already allow; follow `docs/LOGGER.md`.
- Optional test asserting logger called (mock logger) — nice to have.

## Acceptance criteria

- [ ] Successful checkout produces a structured audit log line.
- [ ] No password/token leakage.

## References

- `docs/api/orders/orders-design-review.md` §3 minor
- `docs/LOGGER.md`
