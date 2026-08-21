# T-044 — Escape LIKE wildcards in remaining search endpoints

| Field | Value |
|-------|-------|
| **ID** | T-044 |
| **Priority** | P2 |
| **Status** | todo |
| **Type** | `bugfix` |
| **Branch** | `bugfix/search-like-escape-all-modules` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

T-013 covers orders admin search only. The same `%`/`_` wildcard passthrough exists in:

- Products customer search + brand filter (`product.repository.ts:149-159`)
- Categories customer/admin search (`category.repository.ts:80-85, 112-118`)
- Inventory admin search (`inventory.repository.ts:116-121`)
- Admin users search (`users.repository.ts:65-72`)

Parameterized (no injection), but `search=%` matches the entire catalog plus a full count scan per request; `_` acts as any-char. Reviews module already escapes correctly (`review.repository.ts:126-128, 171-182`).

## Goal

Literal `%`, `_`, `\` behave as characters in every search endpoint.

## Scope

- Extract the reviews escape helper into a shared util.
- Apply across the four locations above (and orders if T-013 not yet done — then close both).
- Tests per endpoint with literal `%`/`_`.

## Acceptance criteria

- [ ] Literal metacharacters match as characters everywhere; no full-scan pattern abuse.
- [ ] Shared helper used; no duplicated escape logic.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.4
- Sibling: T-013
