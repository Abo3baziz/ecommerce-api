# T-041 — Enforce primary-image invariant with a partial unique index

| Field | Value |
|-------|-------|
| **ID** | T-041 |
| **Priority** | P2 |
| **Status** | todo |
| **Type** | `bugfix` |
| **Branch** | `bugfix/primary-image-invariant` |
| **Depends on** | T-047 (index/migration approach) |
| **Blocks** | — |

## Problem

Primary-image promotion computes state outside the transaction (`imageCount` read at `productImage.service.ts:92-99`), then clears+sets inside it. No DB constraint backs the exactly-one-primary invariant (`schema.prisma:233-248` has plain indexes). Two interleaved admin promotions both end `is_primary = true`; cover image becomes ambiguous across clients.

## Goal

At most one primary image per product, enforced by the database.

## Scope

- Add partial unique index `(products_id) WHERE is_primary = true` (and same for variant images if applicable) via migration/baseline (coordinate T-047).
- Catch P2002 → 409 Conflict on promotion races.
- Move invariant-relevant reads inside the transaction.

## Acceptance criteria

- [ ] Concurrent promotions test ends with exactly one primary; loser 409.
- [ ] Existing product-image suite green.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.4
