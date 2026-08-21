# T-059 — Make registration transactional

| Field | Value |
|-------|-------|
| **ID** | T-059 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `bugfix` |
| **Branch** | `bugfix/transactional-registration` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

`register()` performs three independent writes: `createUser` → `createSession` → `issueVerificationToken` (`auth.service.ts:55-71`). Failure in steps 2-3 returns 500 while the user row persists; the retry yields 409 with an account that has no session and possibly no verification email. Mail-send failures are already swallowed correctly.

## Goal

Partial registration states are impossible.

## Scope

- Wrap user creation + verification-token issuance in one `$transaction`.
- Create the session after commit (session failure is retryable via login) or inside if trivially safe.

## Acceptance criteria

- [ ] Injected failure test: no orphan user rows.
- [ ] Existing auth suites green.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.2
