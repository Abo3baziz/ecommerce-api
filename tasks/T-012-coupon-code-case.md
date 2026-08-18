# T-012 — Orders §2.6 — Coupon code case-insensitivity

| Field | Value |
|-------|-------|
| **ID** | T-012 |
| **Priority** | P2 |
| **Status** | done |
| **Type** | `bugfix` |
| **Branch** | `bugfix/coupon-code-case` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

`findCouponByCode` uses exact match. Users typing `welcome10` vs `WELCOME10` get 409. Case sensitivity may be intentional but is undocumented.

## Goal

Either (a) normalize codes to uppercase on write and lookup, or (b) document exact case-sensitive matching as intentional.

## Recommended approach

Normalize to uppercase on create/update and on checkout lookup; migrate existing rows if needed.

**Chosen: option (a)** — normalize to uppercase on write and lookup; `findCouponByCode` additionally matches case-insensitively so existing mixed/lowercase rows still resolve.

## Scope

- Implement chosen approach.
- Tests for mixed-case input.
- Mark §2.6 resolved / documented in design review + orders.md.

## Acceptance criteria

- [x] Behavior matches documented rule.
- [x] Tests cover the chosen semantics.
- [x] Docs updated.

## References

- `docs/api/orders/orders-design-review.md` §2.6
