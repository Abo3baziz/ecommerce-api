# T-070 — Deterministic pagination tiebreakers for products/variants

| Field | Value |
|-------|-------|
| **ID** | T-070 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `bugfix` |
| **Branch** | `bugfix/product-pagination-tiebreaker` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

Products and variants lists ORDER BY a single whitelisted key with no secondary key (`product.service.ts:154-160, 189-195`; `variant.service.ts:79-86`). Ties (identical `created_at` millisecond) leave DB ordering undefined → duplicated/skipped rows across pagination pages. Categories and reviews already append `{ id: direction }` (fixed in earlier work); products/variants were missed.

## Goal

Stable, deterministic ordering on every paginated list.

## Scope

- Append `{ id: direction }` as secondary orderBy in products/variants lists (and any other list missing it — sweep).
- Note: `parseSort` output is cast `as Prisma.*OrderByWithRelationInput`; runtime safety rests on the zod whitelist — keep whitelist and model fields in sync or derive from a typed map.

## Acceptance criteria

- [ ] Same-timestamp fixtures paginate without dup/skip.
- [ ] Sweep note for remaining lists.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.4
- Pattern: categories sort tiebreaker fix (`c73b49a`)
