# T-092 — Report service window resolver + data fetch

| Field | Value |
|-------|-------|
| **ID** | T-092 |
| **Priority** | P2 |
| **Status** | done |
| **Type** | `feature` |
| **Branch** | `feature/reports-pdf` |
| **Depends on** | T-090, T-091 |
| **Blocks** | T-093, T-094, T-095 |

## Problem

Reports must accept `month | quarter | year | custom` and resolve to a single half-open `[from, to)` UTC window with an auto `day/month` bucket for series, mirroring the analytics window logic but extended for calendar periods.

## Goal

Provide `src/modules/reports/service/report.service.ts` with a canonical window resolver and parallel data fetchers for the three report types.

## Scope

- `resolveReportWindow(q)` → `ReportWindow{ from, to, label, bucket }` using `startOfUtcDay` from `src/modules/analytics/service/overview.service.ts`:
  - `month` → `[UTC startOfMonth(year,month), startOfNextMonth)`
  - `quarter` → `[startOfQuarter(year,quarter), startOfNextQuarter)` (Q1 Jan, Q2 Apr, Q3 Jul, Q4 Oct)
  - `year` → `[Jan01, Jan01 next year)`
  - `custom` → `[date_from, date_to)` half-open for `orders.placed_at TIMESTAMPTZ`; corresponding `BETWEEN from::date AND to::date` for `operating_expenses.spent_at DATE` is handled in the repository.
- `granularity: auto → day if window ≤ 31d else month`; explicit `day/month` overrides auto; maps to SQL `date_trunc('day'|'month', placed_at)`.
- `getPnlData(window)`, `getExpensesData(window, category?)`, `getRevenueData(window)` via `Promise.all` of repo calls (totals, COGS, opex, refunded, series with `trunc`, topProducts 8, categoryShare, customerCounts, coupons). Zero-fill series like `overview.service.ts` `buildSeries`.
- Currency is formatting-only (no SQL conversion); Decimal math stays `Prisma.Decimal` with 2dp profit calcs: `gross_profit = product_revenue - cogs`, `net_profit = gross_profit - opex`.

## Acceptance criteria

- [x] `2024-02` (leap) and `2026-Q4 → 2027-01-01` correctly resolved; `2026-02-29` leap edge covered.
- [x] `custom` window > 366d is rejected at validation (not at service).
- [x] Auto bucket: 30d window → `day`, 90d quarter → `month`.
- [x] Data fetch returns consistent totals vs existing analytics overview for the same window.

## Implementation notes (2026-08-31)

- Created `src/modules/reports/service/report.service.ts` with `resolveReportWindow` (month/quarter/year/custom, UTC half-open, auto `day|month` bucket) and `getPnlData`/`getExpensesData`/`getRevenueData` via parallel `analyticsRepository` + `findOpexByCategory`/`findRevenueSeriesTruncated`.
- Added `findRevenueSeriesTruncated`/`findOpexSeriesTruncated` in `report.repository.ts` for `date_trunc('day'|'month')`.

## References

- `src/modules/analytics/service/overview.service.ts:1`, `src/config/database.ts:1` (`timezone=UTC`), `prisma/schema.prisma:143` (`orders`)
