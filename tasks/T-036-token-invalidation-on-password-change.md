# T-036 — Invalidate pending verification tokens on credential rotation

| Field | Value |
|-------|-------|
| **ID** | T-036 |
| **Priority** | P2 |
| **Status** | todo |
| **Type** | `bugfix` |
| **Branch** | `bugfix/token-invalidation-on-password-change` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

`changePassword` (`src/modules/users/service/users.service.ts:95-116`) updates the hash and revokes other sessions but does not invalidate outstanding `PASSWORD_RESET` tokens. A reset link issued before the rotation stays valid for its full 1-hour TTL and would revoke all sessions again — defeating the point of rotating credentials after suspected compromise.

## Goal

Changing the password kills every pending token that could alter credentials or contact info.

## Scope

- Inside one transaction: password update + `invalidateUnusedVerificationTokens(id, PASSWORD_RESET)`.
- Decide deliberately whether pending `CHANGE_EMAIL` / `CHANGE_PHONE_NUMBER` tokens also die on password rotation (recommended yes) and document the rule.
- Mirror decision for `verifyPasswordReset` (kill CHANGE_* tokens there too).

## Acceptance criteria

- [ ] Outstanding reset token used after a password change → 410/404, password unchanged.
- [ ] Documented rule for each token purpose.
- [ ] Integration tests for both flows.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.2
- Pattern: `requestPasswordReset` invalidation (`auth.service.ts:269-272`)
