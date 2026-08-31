# T-094 — Expenses & Revenue PDF renderers

| Field | Value |
|-------|-------|
| **ID** | T-094 |
| **Priority** | P2 |
| **Status** | done |
| **Type** | `feature` |
| **Branch** | `feature/reports-pdf` |
| **Depends on** | T-088, T-089, T-092 |
| **Blocks** | T-095 |

## Problem

Expenses and Revenue detail PDFs share the PDF infra but have distinct layouts; neither exists.

## Goal

Implement `renderExpensesPdf(data, currency)` and `renderRevenuePdf(data, currency)` that each return a paginated, chart-enhanced `Buffer`.

## Scope

- `renderExpensesPdf`:
  - Summary: total, avg/day, period length; by-category table (category, total, share %) + bar chart via `renderOpexByCategoryBar`.
  - Detail table: `spent_at`, `public_id` (`exp_` via `PUBLIC_ID_PREFIXES.EXPENSE` `src/shared/constants`), `description` (255ch wrap), `category`, `amount` (formatted), `created_by` (`usr_*` name). Ordered `spent_at DESC, id DESC`. Auto `doc.addPage()` after ~50 rows.
  - Category subtotal footer per page optional; final totals footer.
- `renderRevenuePdf`:
  - Series line chart (gross vs net) + table (bucket_start, gross, net, order_count), bucket totals, orders summary (count, AOV, refunded_total), top_products 5..8 + category share pie + table.
  - Reuse `src/shared/pdf/format.ts` currency param for all money columns/axes.
- Both renderers use `Prisma.Decimal` → `formatMoney`; no internal `id` exposure.

## Acceptance criteria

- [x] Expenses PDF with > 50 rows paginates (footer `Page N / M` increments) without clipping.
- [x] Revenue PDF for quarter window shows monthly buckets and monthly totals.
- [x] Both return `%PDF-` buffers; `format-pdf` branch for `null` charts still renders tables.

## Implementation notes (2026-08-31)

- Added `renderExpensesPdf` (KPI, byCategory table+bar, detail table paginated) and `renderRevenuePdf` (summary, series line, top products, category pie) in same `pdf.service.ts`; both use `formatMoney(value,currency)` for localization.

## References

- `src/modules/analytics/service/expenses.service.ts:1`, `src/shared/constants/index.ts` (`PUBLIC_ID_PREFIXES`), `src/shared/pdf/charts.ts` (T-089)
