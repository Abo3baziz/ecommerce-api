# T-082 — Paymob DB migration (payments provider columns)

| Field | Value |
|-------|-------|
| **ID** | T-082 |
| **Priority** | P0 |
| **Status** | wontfix |
| **Type** | `feature` |
| **Branch** | `feature/paymob-db` |
| **Depends on** | T-081 |
| **Blocks** | T-084, T-085 |

## Problem

The `payments` table has no way to distinguish gateways or correlate a
pending Paymob checkout. The unique `transaction_reference` column is only
populated after the webhook arrives; intention id must be stored for
inquiry/lookup and idempotency.

## Goal

Add provider metadata columns to `payments` via a Prisma migration, with a
safe backfill for existing mock rows.

## Scope

- Migration: `payments`
  - `provider VARCHAR(50) NOT NULL DEFAULT 'mock'`
  - `provider_intention_id VARCHAR(100) NULL` + unique index (idempotency +
    inquiry lookups by Paymob intention id)
- Backfill: existing rows keep `provider='mock'` via the column default.
- Update `docs/DATABASE.md` payments table section + `docs/API_ENDPOINTS.md`
  payment payload field list (`provider`).
- Verify migration up/down with `npm run db:migrate`.

## Out of scope

- Storing `client_secret` (single-use; returned to frontend once).
- Storing raw webhook payloads.

## Acceptance criteria

- [ ] Migration applies cleanly on a fresh DB and on an existing DB with mock rows.
- [ ] `provider` defaults to `mock` for existing rows.
- [ ] `provider_intention_id` unique constraint in place.
- [ ] Docs updated; typecheck green.

## References

- T-002
- `prisma/schema.prisma` — `payments` model
- `docs/DATABASE.md` — Payments section