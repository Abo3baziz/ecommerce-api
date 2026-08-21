# T-020 — Defensive shipment null guards

| Field | Value |
|-------|-------|
| **ID** | T-020 |
| **Priority** | P2 |
| **Status** | todo |
| **Type** | `bugfix` |
| **Branch** | `bugfix/shipment-null-guards` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

Order mappers use `row.shipments!` non-null assertions. Safe while checkout always creates a shipment; legacy/partial rows would throw obscurely.

## Goal

Replace non-null assertions with explicit checks and a clear domain error (or nullable DTO field if product allows).

## Scope

- `orders.service.ts` / `admin.service.ts` mapping paths.
- Prefer fail-soft 500/409 with message over raw TypeError.
- Test with fixture missing shipment if feasible.

## Acceptance criteria

- [ ] No `shipments!` assertions in hot paths.
- [ ] Missing shipment yields controlled error.

## References

- `docs/api/orders/orders-design-review.md` §3
