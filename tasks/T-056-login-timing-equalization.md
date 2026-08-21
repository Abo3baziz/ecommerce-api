# T-056 — Equalize login timing for unknown users (dummy bcrypt compare)

| Field | Value |
|-------|-------|
| **ID** | T-056 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `bugfix` |
| **Branch** | `bugfix/login-timing` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

Unknown email → immediate 401 with no KDF work; known email → bcrypt cost-12 compare (~100-300ms) (`auth.service.ts:83-93`). Messages are identical but wall-clock differs measurably. Marginal today (register's inherent 409 already enumerates), still worth closing.

## Goal

Login response time is independent of account existence.

## Scope

- Precompute a dummy cost-12 hash; on unknown user run `compare(input.password, DUMMY_HASH)` before throwing the same error.
- Constant-time path documented.

## Acceptance criteria

- [ ] Timing distribution indistinguishable in a simple benchmark test/manual check.
- [ ] Suite green.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.2
