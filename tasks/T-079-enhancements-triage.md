# T-079 — ENHANCEMENTS.md triage: phone flow + duplicate-endpoint claims

| Field | Value |
|-------|-------|
| **ID** | T-079 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `bugfix` |
| **Branch** | `bugfix/enhancements-triage` |
| **Depends on** | — |
| **Blocks** | T-071 (address items) |

## Problem

`ENHANCEMENTS.md` (untracked, undated) lists user-reported issues. Verification status:

- `POST users/me/email` same-email message: **already implemented** (`users.service.ts:128-132`).
- `POST users/me/phone-number` same-phone message: **already implemented** (`users.service.ts:217-221`); the "not working" claim is unverified and needs reproduction.
- `POST users/me/email/verify` "duplicated email verification endpoint": unclear claim; needs investigation (possible confusion with `/auth/email-verification/verify`).
- Address items (postal_code rename, drop country) → tracked as T-071.
- Empty `admin/products` section: clarify intent or delete.

## Goal

Every ENHANCEMENTS.md item resolved, implemented, or explicitly rejected; file updated/removed.

## Scope

- Reproduce the phone-flow failure (manual + e2e); fix if real.
- Investigate the "duplicate endpoint" claim against the router map; document finding.
- Update or retire ENHANCEMENTS.md; move accepted items into task files (T-071 exists).

## Acceptance criteria

- [ ] Each bullet has an outcome recorded (done/rejected/duplicate-doc).
- [ ] Phone-flow regression test if a bug was found.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.4
- `ENHANCEMENTS.md`
