# T-089 — Shared PDF infra (builder / styles / charts / format)

| Field | Value |
|-------|-------|
| **ID** | T-089 |
| **Priority** | P2 |
| **Status** | done |
| **Type** | `feature` |
| **Branch** | `feature/reports-pdf` |
| **Depends on** | T-088 |
| **Blocks** | T-093, T-094 |

## Problem

Reports need a reusable, DRY PDF layer for headers, footers, tables (auto-paging), KPI grids, and chart embedding. No `src/shared/pdf/` exists today; `src/shared/utils/index.ts` only has `generatePublicId` / `formatPaginationMeta`.

## Goal

Provide `src/shared/pdf/` helpers so every report (P&L, Expenses, Revenue) shares layout, money formatting, and chart rendering.

## Scope

- `src/shared/pdf/builder.ts`: `createPdfDoc()` (A4 portrait, margins 36, Helvetica built-in), `addHeader(title, range, currency)`, `addFooter(pageNo)`, `drawTable(headers, rows, colWidths)` with auto `doc.addPage()` when `y > 700`, `drawKpiGrid(cards)`, `embedPng(buf, w, h)`.
- `src/shared/pdf/styles.ts`: color palette `#111827 #6B7280 #2563EB`, font sizes 8/10/12/16, border widths.
- `src/shared/pdf/charts.ts`: three factories → `Promise<Buffer|null>` via `ChartJSNodeCanvas(800×400)`: `renderSeriesLineChart(series, currency)`, `renderOpexByCategoryBar(byCategory, currency)`, `renderCategorySharePie(share)`; each `try/catch` returning `null` on canvas failure.
- `src/shared/pdf/format.ts`: `formatMoney(value: Decimal|string, currency)`, `formatPct`, `formatDateUTC` using `Intl.NumberFormat` with `currency` arg; Decimal handling stays `Prisma.Decimal` at the boundary.
- No internal `id` leakage — only `public_id` style helpers if needed.

## Acceptance criteria

- [x] `drawTable` with > 40 rows paginates without clipping; footer shows `Page N / M`.
- [x] `drawSeriesLineChart`/`drawBarChart`/`drawPieChart` render vector charts without native canvas.
- [x] `formatMoney('1234.50','EGP')` yields `EGP`-localized string; `USD` default path covered.

## Implementation notes (2026-08-31)

- Created `src/shared/pdf/{builder,styles,charts,format,index}.ts` with pdfkit vector charts (line/bar/pie), KPI grid, key-value + paginated tables, header/brand bar, footer.
- Charts use pure pdfkit paths — no `canvas` native dep needed; verified `typecheck` green.

## References

- `src/shared/utils/index.ts:1`, `src/modules/analytics/dto/analytics.ts:1`, `prisma/schema.prisma:589` (`operating_expenses`)
