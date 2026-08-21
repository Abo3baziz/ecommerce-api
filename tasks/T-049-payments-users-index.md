# T-049 — Add missing index on payments.users_id

| Field | Value |
|-------|-------|
| **ID** | T-049 |
| **Priority** | P2 |
| **Status** | todo |
| **Type** | `chore` |
| **Branch** | `chore/payments-users-index` |
| **Depends on** | T-047 preferred (migration path) |
| **Blocks** | — |

## Problem

`payments.users_id` is the only FK column in the schema without an index (schema.prisma:205-218 indexes orders_id/paid_at/public_id/status/transaction_reference but not users_id). Postgres does not auto-index FK columns. User payment-history joins/filters and test cleanup (`tests/helpers/db.ts:24-26` filters `payments.users_id IN (...)`) degrade to seq scans as the table grows.

## Goal

All FK columns indexed.

## Scope

- `@@index([users_id])` on payments.
- Re-verify no other unindexed FK slipped in since the audit.

## Acceptance criteria

- [ ] Schema updated; applied via migration (or db push per current workflow).
- [ ] Query plan uses the index for a users-scoped payments query.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.5
