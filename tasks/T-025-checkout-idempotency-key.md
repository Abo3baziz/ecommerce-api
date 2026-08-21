# T-025 — Checkout `Idempotency-Key` support

| Field | Value |
|-------|-------|
| **ID** | T-025 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `feature` |
| **Branch** | `feature/checkout-idempotency-key` |
| **Depends on** | T-002 strongly recommended |
| **Blocks** | — |

## Problem

After a successful checkout the cart is gone; a client retry on network timeout gets 404 instead of the original order. Acceptable for mock v1; weak once real payments exist.

## Goal

Support `Idempotency-Key` header on `POST /orders` so retries return the original order safely.

## Scope

- Persist key → order mapping (per user, TTL).
- Replay response for duplicate keys with same payload hash; conflict on key reuse with different body.
- Docs + tests.
- Pairs with payment intent idempotency on the provider side.

## Acceptance criteria

- [ ] Duplicate checkout with same key returns the same order.
- [ ] Different body + same key → 409.
- [ ] Docs + tests.

## References

- `docs/api/orders/orders-design-review.md` §3 Idempotency
