# T-016 — Typecheck `tests/` in CI

| Field | Value |
|-------|-------|
| **ID** | T-016 |
| **Priority** | P2 |
| **Status** | todo |
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

- [ ] CI fails on test type errors.
- [ ] Documented in TESTING.md if needed.
- [ ] Suite still green.

## References

- `PROJECT_PROGRESS.md` — Pending
- `tsconfig.json`
- `.github/workflows/`
