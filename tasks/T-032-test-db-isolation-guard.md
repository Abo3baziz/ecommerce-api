# T-032 — Test/dev database isolation + destructive-cleanup guard

| Field | Value |
|-------|-------|
| **ID** | T-032 |
| **Priority** | P1 |
| **Status** | todo |
| **Type** | `chore` |
| **Branch** | `chore/test-db-isolation` |
| **Depends on** | — |
| **Blocks** | T-017 (repo unit tests need a safe harness) |

## Problem

Local `.env` and `.env.test` contain the identical `DATABASE_URL` (`Ecommerce_DB?schema=Ecommerce`). Tests therefore run against the development schema, and `tests/helpers/db.ts:53-68` runs unconditional `deleteMany({})` on products/categories/coupons/etc. — running `npm test` wipes all local development catalog data. Nothing prevents pointing the suite at staging/prod.

## Goal

Tests can never destroy non-test data.

## Scope

- Provision a dedicated test database/schema (or container) and update `.env.test.example`.
- Fail fast in `tests/setup/` when the test URL equals the dev URL or lacks a test marker (e.g. database/schema name must match `*test*`).
- Make destructive catalog deletes conditional on the marker; keep `test-*` scoping as second layer.
- Document setup in `docs/TESTING.md`.

## Acceptance criteria

- [ ] Setup aborts with a clear error when targeting a non-test database.
- [ ] Dev data survives a full suite run.
- [ ] CI updated to the isolated DB.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.5
- `vitest.config.ts`, `tests/helpers/db.ts`, `.env.test.example`
