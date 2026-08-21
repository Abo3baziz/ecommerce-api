# T-039 — Guard admin edits of customer contact fields

| Field | Value |
|-------|-------|
| **ID** | T-039 |
| **Priority** | P2 |
| **Status** | todo |
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

- [ ] Regular admin editing email/phone → 403 (or field rejected).
- [ ] Changed contact fields start unverified; user notified.
- [ ] Docs (`docs/api/admin/admin.md`) updated; tests green.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.2
