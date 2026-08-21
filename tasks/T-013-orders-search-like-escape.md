# T-013 — Orders §2.7 — Escape LIKE wildcards in search

| Field | Value |
|-------|-------|
| **ID** | T-013 |
| **Priority** | P2 |
| **Status** | todo |
| **Type** | `bugfix` |
| **Branch** | `bugfix/orders-search-like-escape` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

Admin orders search interpolates user input into `ILIKE` patterns. `%` and `_` act as wildcards (parameterized — no SQL injection, but surprising matches). Reviews admin search already escapes these; orders should match.

## Goal

Escape `%` and `_` (and `\` if needed) before building ILIKE patterns in orders admin search.

## Scope

- Reuse or extract shared escape helper (reviews may already have one).
- Apply in orders repository search.
- Unit/integration test with `%` in search term.
- Mark §2.7 resolved.

## Acceptance criteria

- [ ] Literal `%`/`_` match as characters, not wildcards.
- [ ] Tests green; §2.7 resolved.

## References

- `docs/api/orders/orders-design-review.md` §2.7
- Reviews admin list ILIKE escaping (existing pattern)
