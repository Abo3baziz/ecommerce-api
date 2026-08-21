# T-039 — Guard admin edits of customer contact fields

| Field | Value |
|-------|-------|
| **ID** | T-039 |
| **Priority** | P2 |
| **Status** | done |
| **Type** | `bugfix` |
| **Branch** | `bugfix/admin-contact-edit-guard` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

`PATCH /api/v1/admin/users/:id` accepts `email`/`phone_number` and writes them directly (`src/modules/users/service/admin.service.ts:84-111`) with no reverification, no notification, and no reset of the stale `email_verified_at`. Any ADMIN can repoint a customer's email to an address they control, then use the public unauthenticated password-reset flow to take over the account — leaving only an admin-update log as trace.

## Goal

Admin contact-field edits cannot become a silent account-takeover primitive.

## Scope

- Require SUPER_ADMIN for contact-field edits (route-level authorization split), or drop email/phone from the admin PATCH body entirely (product decision).
- Clear `email_verified_at`/`phone_verified_at` when contact fields change via admin.
- Emit audit log entry + notify the affected user by email where possible.

## Acceptance criteria

- [x] Regular admin editing email/phone → 403 (or field rejected).
- [x] Changed contact fields start unverified; user notified.
- [x] Docs (`docs/api/admin/admin.md`) updated; tests green.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.2

## Implementation

- `updateAdminUser` now receives the acting admin (`{ id, role }`) from `req.user`; when the body contains `email` or `phone_number` and the actor is not `SUPER_ADMIN`, it throws 403 before any write.
- When a contact value actually changes, the service clears `email_verified_at` / `phone_verified_at` in the same update (submitting an unchanged value or name-only edits never touches flags).
- The affected customer is notified at their **previous** email address via a new fire-and-forget mailer (`src/shared/mailer/contactChange.ts` + `templates/contactChange.ts`, shared layout helpers); failures are logged, never thrown.
- Audit trail via structured logger (`actorId`, `targetUserId`, `changedFields`).
- Repository: `findAdminUserStatusByPublicId` select widened for diffing/notification; `updateAdminUser` data type accepts the two verification timestamps.

## Decisions

- Chose **SUPER_ADMIN gating** over dropping contact fields from the PATCH body: preserves legitimate support workflows while confining takeover risk to the single permanent CLI-created super admin; consistent with the `/role` endpoint precedent.
- Gate is presence-based (any attempt to *write* contact fields requires super admin) but verification flags reset only on actual value change — predictable authorization semantics with minimal surprise.
- Notification targets the previous address so the real owner learns of the change even if the new address is attacker-controlled.
