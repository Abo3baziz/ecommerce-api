# T-017 — Repository-layer unit tests

| Field | Value |
|-------|-------|
| **ID** | T-017 |
| **Priority** | P2 |
| **Status** | todo |
| **Type** | `test` |
| **Branch** | `test/repositories` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

Repositories are only exercised via integration/e2e tests. Pure query-building helpers and edge mappings lack fast unit coverage.

## Goal

Add focused unit tests where repositories contain non-trivial pure logic (sort mappers, search pattern builders, raw SQL fragment helpers), without re-testing Prisma itself.

## Scope

- Identify pure helpers in repositories/utils.
- Prefer testing extracted pure functions over heavy Prisma mocks.
- Follow `docs/TESTING.md`.
- No PR required for test-only work unless user asks.

## Acceptance criteria

- [ ] New unit tests for high-value pure repository helpers.
- [ ] No brittle full-Prisma mocks unless justified.
- [ ] `npm test` green.

## References

- `PROJECT_PROGRESS.md` — Pending
- `docs/TESTING.md`
