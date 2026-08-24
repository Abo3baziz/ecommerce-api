# T-016 — Typecheck `tests/` in CI

| Field | Value |
|-------|-------|
| **ID** | T-016 |
| **Priority** | P2 |
| **Status** | done |
| **Type** | `chore` |
| **Branch** | `chore/typecheck-tests` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

`npm run typecheck` only includes `src/**/*`. Test TypeScript errors are not caught until runtime/Vitest transform.

## Goal

Typecheck tests in CI (separate project reference or expanded include).

## Scope

- Add `tsconfig.tests.json` (or solution-style references).
- Script e.g. `npm run typecheck:tests` or fold into `typecheck`.
- Wire into GitHub Actions CI.
- Fix any existing test typing issues uncovered.

## Acceptance criteria

- [x] CI fails on test type errors.
- [x] Documented in TESTING.md if needed.
- [x] Suite still green.

## References

- `PROJECT_PROGRESS.md` — Pending
- `tsconfig.json`
- `.github/workflows/`
