# T-060 — Auth module consistency cleanups

| Field | Value |
|-------|-------|
| **ID** | T-060 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `refactor` |
| **Branch** | `refactor/auth-consistency` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

Assorted verified inconsistencies/dead code in the auth/users surface:

1. `sessions.is_current` write-only dead data (`auth.repository.ts:35`, `auth.service.ts:157`) — never read.
2. Magic string `"ACTIVE"` in `authentication.ts:43` while everything else imports `user_status`.
3. Invalid-token status conventions differ: wrong phone OTP → 400 (`users.service.ts:272-274`) vs wrong email token → 404 (`auth.service.ts:217-219`). Pick one convention (recommend 400 for present-but-wrong OTP, 404 for unknown token, documented).
4. `req.userId` holds the *public* id (`authentication.ts:49`, `express.d.ts:6`) — naming trap vs internal PK `req.user.id`; rename to `req.userPublicId` (mechanical sweep).
5. `verifyPasswordReset` doesn't reject when the account became SUSPENDED/DELETED after issuance, nor check the token's stored target still equals the current email (`auth.service.ts:290-320`).
6. Password has no max length; bcrypt truncates at 72 bytes (`shared/validation/index.ts:18-24`) — add `.max(72)`.

## Goal

One consistent convention per concern; no dead columns/traps.

## Scope

- Items 1-6 as listed; each with tests where behavior changes (3, 5, 6).
- Item 4 is breaking for any out-of-tree consumer — grep thoroughly and note in commit body.

## Acceptance criteria

- [ ] All six resolved; typecheck + suites green; docs touched where conventions changed.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.2
