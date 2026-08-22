# T-040 — Cart mutations must respect the per-user advisory lock

| Field | Value |
|-------|-------|
| **ID** | T-040 |
| **Priority** | P2 |
| **Status** | done |
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

- [x] Concurrency test: checkout vs clear/update interleavings never yield 500; final state consistent.
- [x] Existing cart suite green.

## Implementation notes (2026-08-22)

- Extracted `withUserCartLock(userId, run)` in `cart.service.ts` — a transaction-scoped `pg_advisory_xact_lock(userId)` wrapper — and routed **all** cart mutations through it: `addCartItem` (deduplicated), `updateCartItemQuantity`, `removeCartItem`, and `clearCart`.
- All reads/writes now happen inside the locked transaction (lock-first ordering, mirroring checkout at `orders.service.ts:110`), so a mutation racing checkout either runs entirely before it or re-validates state after it committed.
- "Cart vanished" degrades to the documented 404s ("Cart not found for this user" / "Variant … is not in the cart") — per the documented non-idempotent removal semantics in `docs/api/cart/cart.md`; no behavior change for serial callers.
- Removed the `toCartResult(row!)` null-deref: the final read is checked and maps to `NotFoundError`.
- Residual P2025s are covered by the T-035 global mapper as a backstop.
- Tests: new `tests/integration/cart/cart.race.integration.test.ts` (checkout vs clearCart → exactly one side succeeds across 4 rounds; checkout vs update → order reflects winning quantity, loser gets clean NotFoundError; concurrent duplicate removes → one success + one clean 404) and `tests/e2e/cart/cartConcurrency.api.test.ts` (HTTP-level duplicate line deletions → `[204, 404]`, never 500). Full suite 74 files / 1088 tests green; typecheck + build pass.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.3
