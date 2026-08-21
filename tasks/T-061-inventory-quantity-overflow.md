# T-061 — Cap inventory quantity_change magnitude (int4 overflow)

| Field | Value |
|-------|-------|
| **ID** | T-061 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `bugfix` |
| **Branch** | `bugfix/inventory-quantity-overflow` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

`quantityChangeField` is int with no max (`inventory/validators/inventory.ts:22-27`) and the repository's `gte` guard applies only to negative changes (`inventory.repository.ts:195-210`). `{"quantity_change": 2147483647}` on a row with on_hand = 1 → Postgres "integer out of range" → 500. Admin-only, but a malformed payload should never 500.

## Goal

Bounded deltas; overflow impossible.

## Scope

- Cap magnitude in the validator (e.g. ±1,000,000) and/or extend the atomic guard to both directions.
- 400 on out-of-range input.

## Acceptance criteria

- [ ] Max-magnitude payload → 400, not 500.
- [ ] Validator unit test added.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.3
