# T-097 — Reports unit tests

| Field | Value |
|-------|-------|
| **ID** | T-097 |
| **Priority** | P2 |
| **Status** | done |
| **Type** | `test` |
| **Branch** | `feature/reports-pdf` |
| **Depends on** | T-092, T-089 |
| **Blocks** | T-098 |

## Problem

Window resolver, currency formatting, and PDF helpers need fast, DB-free coverage before integration tests.

## Goal

Add Vitest unit tests (fileParallelism:false pattern from `vitest.config.ts`) for service math and shared PDF helpers.

## Scope

- `tests/unit/reports/report.service.spec.ts`: `resolveReportWindow` — month `2024-02` leap (28/29), quarter `2026-Q4 → 2027-01-01`, year `2026 → [2026-01-01,2027-01-01)`, custom `from<to`, auto `granularity` (30d → `day`, 90d → `month`), explicit override, invalid `period/month` combos.
- `tests/unit/reports/format.spec.ts` or inline: `formatMoney` for `USD,EUR,GBP,EGP,SAR,AED` with `Prisma.Decimal('1234.50')`.
- `tests/unit/shared/pdf/builder.spec.ts`: `drawTable` pagination (40+ rows → `addPage` called), `embedPng(null)` fallback, `drawKpiGrid` does not throw on empty data.
- Mock `chartjs-node-canvas` so canvas is not required for unit tests.

## Acceptance criteria

- [x] `npm run test:unit` (or `vitest run`) green; new unit files follow existing `tests/` layout.
- [x] ≥ 30 cases across the three suites; leap-year/quarter-boundary edges covered.

## Implementation notes (2026-08-31)

- Created `tests/unit/reports/report.service.test.ts` (10 window/bucket cases + leap/quarter roll), `tests/unit/shared/pdf/format.test.ts` (7 money/pct/date), `tests/unit/shared/pdf/builder.test.ts` (3 pagination/KPI). 23 tests passed.

## References

- `vitest.config.ts:1`, `tests/unit/` layout, `src/modules/reports/service/report.service.ts` (T-092), `src/shared/pdf/format.ts` (T-089)
