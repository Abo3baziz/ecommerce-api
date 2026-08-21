# T-063 — Document/enforce the coupon per-user lock invariant

| Field | Value |
|-------|-------|
| **ID** | T-063 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `chore` |
| **Branch** | `chore/coupon-lock-invariant` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

Per-user coupon usage limits are safe today only incidentally: every `coupon_usages` insert happens inside `placeOrder`, which holds the per-user advisory lock (`orders.service.ts:108, 194-203`). `coupon_usages` has no unique constraint that could enforce it for `usage_limit_per_user > 1`. Any future code path inserting usages without the lock reintroduces the double-redemption TOCTOU. (Global limit is atomically guarded and solid.)

## Goal

The invariant is explicit and doesn't depend on an incidental lock.

## Scope

- Minimum: document the invariant loudly at both sites + in orders design docs.
- Defense-in-depth (recommended): `SELECT … FOR UPDATE` the coupon row during validation to serialize per-coupon regardless of caller.

## Acceptance criteria

- [ ] Invariant documented; optional FOR UPDATE implemented with a concurrency test.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.3
