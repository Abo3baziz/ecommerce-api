# T-068 — Product soft-delete dependent-data retention policy

| Field | Value |
|-------|-------|
| **ID** | T-068 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `feature` |
| **Branch** | `feature/product-delete-retention` |
| **Depends on** | T-024 (cart availability display) |
| **Blocks** | — |

## Problem

Product soft-delete only soft-deletes the product + variants (`product.service.ts:270-281`). Left behind: `product_images`/`product_variant_images` rows + CDN assets, `inventory` rows, `cart_items` referencing now-dead variants, reviews on the product, and `product_categories` links until category deletion. Customer visibility itself is correct; the drift pushes validation onto cart/checkout and lets inventory staff mutate stock of never-sellable variants.

## Goal

A documented, implemented retention policy for dependents of deleted products.

## Scope

- Decide per dependent: purge / detach / annotate-at-read (images+CDN, inventory, cart lines, reviews, category links).
- Implement chosen behavior transactionally or via cleanup job (coordinate T-072).
- Cart/checkout surfaces must not choke on dead variant references.

## Acceptance criteria

- [ ] Policy table documented in DATABASE/orders docs.
- [ ] Deleted product leaves no dangling cart/checkout failures in tests.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.4
