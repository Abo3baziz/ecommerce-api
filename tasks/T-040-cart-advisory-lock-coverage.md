# T-040 — Cart mutations must respect the per-user advisory lock

| Field | Value |
|-------|-------|
| **ID** | T-040 |
| **Priority** | P2 |
| **Status** | todo |
| **Type** | `bugfix` |
| **Branch** | `bugfix/cart-advisory-lock-coverage` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

Only `addCartItem` acquires the per-user `pg_advisory_xact_lock` (`src/modules/cart/service/cart.service.ts:99-100`). `updateCartItemQuantity`, `removeCartItem`, and `clearCart` run unlocked and (mostly) non-transactionally. Interleavings with checkout (which holds the lock and ends by deleting the cart, orders.service.ts:346-347) produce: P2025 on cart delete → 500; mid-checkout clear kills a valid checkout with a 500; concurrent update → null deref at `toCartResult(row!)` (cart.service.ts:164).

## Goal

All mutating cart operations serialize against checkout and each other; races degrade to clean 4xx or no-op success, never 500.

## Scope

- Acquire the same advisory lock inside a transaction for update/remove/clear.
- Handle "cart vanished" as idempotent success (204/200) where sensible, or 404 per documented semantics.
- Map residual P2025 via T-035 global mapping.

## Acceptance criteria

- [ ] Concurrency test: checkout vs clear/update interleavings never yield 500; final state consistent.
- [ ] Existing cart suite green.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.3
