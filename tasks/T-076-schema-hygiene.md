# T-076 — Schema hygiene: dead artifacts + timestamp type alignment

| Field | Value |
|-------|-------|
| **ID** | T-076 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `chore` |
| **Branch** | `chore/schema-hygiene` |
| **Depends on** | T-047 (migration path) |
| **Blocks** | — |

## Problem

1. Unused schema artifacts: `password_reset_tokens` table (zero references in src/tests — reset flows through `verification_tokens` with purpose PASSWORD_RESET) and `session_status` enum referenced by no model (`schema.prisma:178-192, 517-521`). Misleading; also `tests/helpers/db.ts` doesn't clean `password_reset_tokens` (21/22 models covered) if anyone starts using it.
2. Mixed timestamp types: `users.email_verified_at`/`phone_verified_at` are TIMESTAMP(6) without timezone while everything else is TIMESTAMPTZ(6) (`schema.prisma:445-446`) — TZ ambiguity in expiry comparisons.

## Goal

Schema contains only live, consistently-typed objects.

## Scope

- Drop both dead artifacts (or document intended use + add cleanup coverage).
- Align the two columns to TIMESTAMPTZ via migration.

## Acceptance criteria

- [ ] Schema clean; migration applied; suites green.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.5
