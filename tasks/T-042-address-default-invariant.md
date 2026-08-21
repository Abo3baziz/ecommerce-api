# T-042 — Fix address default-flag invariant (zero/multi defaults)

| Field | Value |
|-------|-------|
| **ID** | T-042 |
| **Priority** | P2 |
| **Status** | todo |
| **Type** | `bugfix` |
| **Branch** | `bugfix/address-default-invariant` |
| **Depends on** | T-047 |
| **Blocks** | — |

## Problem

Default-address invariants are enforced only by app code with races and a normal-path hole:

- PATCHing the current default to `false` just unsets it (`address.service.ts:117-118`) → zero defaults with no race needed.
- `existingCount` read outside the tx (:66) → two concurrent first-address creates both become defaults.
- Concurrent updates setting different addresses default interleave clears → zero defaults.
- `deleteAddress` never promotes a successor.

## Goal

Every user has at most one default per type, and at least one where addresses exist.

## Scope

- Partial unique indexes per user per flag: `(users_id) WHERE is_default_shipping AND deleted_at IS NULL` (same for billing) — coordinate with T-047 migrations.
- Promote-on-delete/clear inside the same transaction; compute defaults inside tx.
- Decide + document behavior when user unsets the last default (auto-promote oldest vs allow zero).

## Acceptance criteria

- [ ] Concurrent create/update/delete tests never yield multi-default; zero-default only if product-decided.
- [ ] P2002 races mapped to retry/409; suite green.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.4
