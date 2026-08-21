# T-055 — Atomic single-use token claiming

| Field | Value |
|-------|-------|
| **ID** | T-055 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `bugfix` |
| **Branch** | `bugfix/atomic-token-claim` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

Used/expired checks happen outside transactions and invalidation is a blind `update` by id with no `used_at: null` guard or rowcount check (`auth.repository.ts:99-108`; call sites `auth.service.ts:209-235, 290-320`, `users.service.ts:164-205, 252-301`). Two concurrent verifications both pass the guard and both commit — formally violating single-use semantics (outcomes currently near-idempotent, so low impact).

## Goal

Token claim is atomic: exactly one concurrent consumer wins.

## Scope

- Replace with `updateMany({ where: { id, used_at: null }, data })`; count 0 → treat as already-used (409/410).
- Apply to email verify, password reset, email change, phone OTP.

## Acceptance criteria

- [ ] Concurrent double-claim test: one success, one clean failure.
- [ ] Existing token suites green.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.2
