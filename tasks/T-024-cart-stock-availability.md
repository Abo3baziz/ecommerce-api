# T-024 — Cart line stock availability (`max_available`)

| Field | Value |
|-------|-------|
| **ID** | T-024 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `feature` |
| **Branch** | `feature/cart-stock-availability` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

Cart stores quantity only; availability is not exposed. Customers can hold quantities above stock until checkout fails with 409.

## Goal

Optionally expose `max_available` (or similar) on cart lines without breaking the customer product contract elsewhere.

## Scope

- Design decision: compute live from inventory at cart read time.
- API field addition (document as additive, non-breaking).
- Tests + docs.

## Acceptance criteria

- [ ] Cart GET includes availability signal per line.
- [ ] Oversell still prevented at checkout.
- [ ] Docs + tests.

## References

- `PROJECT_PROGRESS.md` — Pending
- Cart module docs
