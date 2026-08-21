# T-047 — Baseline Prisma migrations and adopt migrate deploy

| Field | Value |
|-------|-------|
| **ID** | T-047 |
| **Priority** | P2 |
| **Status** | todo |
| **Type** | `chore` |
| **Branch** | `chore/migrations-baseline` |
| **Depends on** | — |
| **Blocks** | T-041, T-042, T-043, T-071, T-076 (all need real migrations) |

## Problem

`docs/DATABASE.md` mandates versioned migrations ("Direct modification of production databases outside the migration process is prohibited") but `prisma/migrations/` does not exist; CI uses `db push --accept-data-loss`; `prisma.config.ts` declares a migrations path that doesn't exist. Ten models carry "contains check constraints" comments — those DB-level constraints are not recreatable by `db push` into a fresh environment, so fresh deploys silently miss them.

## Goal

Replayable migration history; fresh environments match production including check constraints.

## Scope

- Baseline: `prisma migrate diff` from empty → current schema; hand-add the 10 tables' check constraints to the baseline SQL.
- Add `migrate deploy` script + CI usage (replace `db push --accept-data-loss`).
- Resolve the DATABASE.md/implementation conflict explicitly (report per AGENTS.md).

## Acceptance criteria

- [ ] Fresh database from `migrate deploy` includes all check constraints.
- [ ] CI green without data-loss flags.
- [ ] Docs updated; conflict note removed.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.5
- `prisma.config.ts`, `.github/workflows/ci.yml`
