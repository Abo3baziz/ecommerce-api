# T-058 — Free email/phone of soft-deleted accounts (squatting policy)

| Field | Value |
|-------|-------|
| **ID** | T-058 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `feature` |
| **Branch** | `feature/delete-account-anonymization` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

`deleteAccount` soft-deletes but keeps unique email/phone (`users.service.ts:79-93`; global uniques in schema). The tombstoned row permanently blocks re-registration (409 "Email is already registered" — also a historical-existence oracle) and PII (name/email/phone) is retained indefinitely. Login-as-deleted → 403 and auth blocking are handled correctly.

## Goal

Deleted users' contact fields become reusable; retention policy explicit.

## Scope

- Product decision: anonymize contact fields on delete (e.g. `deleted+{public_id}@invalid`, phone likewise) vs documented reservation window.
- If anonymizing: do it in the delete transaction; keep referential integrity (orders still reference the user).
- Document retention/PII policy in docs.

## Acceptance criteria

- [ ] Email/phone reusable after deletion per chosen policy.
- [ ] Historical orders remain intact; tests green.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.2
