# T-036 — Invalidate pending verification tokens on credential rotation

| Field | Value |
|-------|-------|
| **ID** | T-036 |
| **Priority** | P2 |
| **Status** | done |
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

- [x] Outstanding reset token used after a password change → 410/404, password unchanged.
- [x] Documented rule for each token purpose.
- [x] Integration tests for both flows.

## Implementation

- `authRepository.invalidateUnusedVerificationTokens` gained an optional `DbClient` param; new `invalidateUnusedCredentialTokens(users_id, client)` sweeps all unused tokens whose `purpose` is `PASSWORD_RESET`, `CHANGE_EMAIL`, or `CHANGE_PHONE_NUMBER` in one guarded `updateMany`.
- `changePassword` now runs password update + revoke-other-sessions + the credential-token sweep inside one `$transaction` (`revokeAllOtherSessions` also gained an optional client param).
- `verifyPasswordReset` runs the same sweep in its existing transaction after consuming the claimed reset token.

## Decisions

- Pending `CHANGE_*` tokens **do** die on password rotation (recommended option adopted): an attacker with pre-rotation contact-change links must not be able to apply them after the owner rotates credentials.
- `REGISTER_EMAIL` survives rotation: it only flips the verification flag and cannot alter credentials or contact info.
- The sweep marks rows used (`used_at`) rather than deleting them, preserving the existing single-use audit trail; replaying a swept reset link returns 410 "already been used".

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.2
- Pattern: `requestPasswordReset` invalidation (`auth.service.ts:269-272`)
