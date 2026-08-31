# T-090 — Report validators & DTOs (period / currency)

| Field | Value |
|-------|-------|
| **ID** | T-090 |
| **Priority** | P2 |
| **Status** | done |
| **Type** | `feature` |
| **Branch** | `feature/reports-pdf` |
| **Depends on** | — |
| **Blocks** | T-092, T-095 |

## Problem

No validation exists for `month | quarter | year | custom` periods, configurable currency, or granularity/disposition. Reports must reuse the `src/middleware/validate.ts` + Zod pattern used by `src/modules/analytics/validators/admin.ts`.

## Goal

Define query validators and DTOs for all reports so invalid windows/currencies fail with 400 and valid windows flow to the service.

## Scope

- `src/modules/reports/validators/admin.ts`: `reportQuerySchema` base + `pnlQuerySchema`, `expensesQuerySchema` (adds optional `category: expense_category`), `revenueQuerySchema`.
  - `period: enum('month','quarter','year','custom')` default `custom`.
  - `year: 2000..2100` required if `period !== 'custom'`.
  - `month: 1..12` required if `period === 'month'`.
  - `quarter: 1..4` required if `period === 'quarter'`.
  - `date_from/date_to: ISO datetime` required if `custom`, `superRefine` `from < to` + max range 366 days, reject `date_*` when `period !== 'custom'`.
  - `granularity: 'auto'|'day'|'month'` default `auto` (`auto` → `day` if window ≤ 31d else `month`).
  - `currency: enum('USD','EUR','GBP','EGP','SAR','AED')` default `USD` (configurable, documented currencies).
  - `disposition: 'attachment'|'inline'` default `attachment`.
  - Reuse `src/shared/validators.ts` pagination where applicable.
- `src/modules/reports/dto/reports.ts`: `ReportWindow{ from: Date, to: Date, label: string, bucket: 'day'|'month' }`, `ReportCurrency`, plus re-exported analytics DTO helpers.

## Acceptance criteria

- [x] `GET ?period=month&year=2026` without `month` → 400.
- [x] `GET ?period=custom` without `date_from/date_to` → 400; `date_from >= date_to` → 400; > 366d → 400.
- [x] `GET ?currency=XYZ` → 400; `?currency=EGP` → 200 (localized in PDF).
- [x] `?period=year&date_from=...` is rejected (mixed period + custom).

## Implementation notes (2026-08-31)

- Created `src/modules/reports/validators/admin.ts` with `superRefine` period rules and `REPORT_CURRENCIES`/`REPORT_PERIODS` enums, and `src/modules/reports/dto/reports.ts` with `ReportWindow`/`SupportedCurrency`/`buildFilename`.

## References

- `src/modules/analytics/validators/admin.ts:1`, `src/middleware/validate.ts:1`, `src/shared/validators.ts:1`, `prisma/schema.prisma:1` (`expense_category`)
