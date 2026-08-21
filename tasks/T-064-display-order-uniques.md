# T-064 — Unique constraints for image display_order

| Field | Value |
|-------|-------|
| **ID** | T-064 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `bugfix` |
| **Branch** | `bugfix/display-order-uniques` |
| **Depends on** | T-047 preferred |
| **Blocks** | — |

## Problem

Image ordering relies on racy check-then-write: create computes max+1, update checks conflicts outside the transaction (`productImage.service.ts:45-66, 163-174`; `variantImage.service.ts:53-74, 151-162`). No unique constraints back it (`schema.prisma:245, 259` are plain indexes). Concurrent writes yield duplicate `display_order` values → nondeterministic ordering between customer/admin views.

## Goal

Deterministic image ordering enforced by the database.

## Scope

- Unique indexes `(products_id, display_order)` / `(product_variants_id, display_order)` (decide soft-delete interplay if applicable) via T-047 migration.
- P2002 → 409; move conflict checks inside transactions.
- Backfill/dedupe script if existing rows violate.

## Acceptance criteria

- [ ] Concurrent insert/update tests: one wins, other 409.
- [ ] Ordering deterministic across views.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.4
