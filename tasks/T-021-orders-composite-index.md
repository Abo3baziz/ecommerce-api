# T-021 — Composite index `(users_id, placed_at)` on orders

| Field | Value |
|-------|-------|
| **ID** | T-021 |
| **Priority** | P2 |
| **Status** | todo |
| **Type** | `chore` / db |
| **Branch** | `chore/orders-user-placed-index` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

Customer order list filters by `users_id` and sorts by `placed_at DESC`. A composite index would serve this access path better at scale.

## Goal

Add index and document in `docs/DATABASE.md`.

## Scope

- Migration / schema note (project may use db-pull workflow — follow existing DB change process).
- Document indexing strategy.
- No API changes.

## Acceptance criteria

- [ ] Index exists in schema/DB.
- [ ] DATABASE.md updated.

## References

- `docs/api/orders/orders-design-review.md` §3 index coverage
- `docs/DATABASE.md`
