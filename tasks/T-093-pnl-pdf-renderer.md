# T-093 — P&L PDF renderer (KPIs + charts + tables)

| Field | Value |
|-------|-------|
| **ID** | T-093 |
| **Priority** | P2 |
| **Status** | done |
| **Type** | `feature` |
| **Branch** | `feature/reports-pdf` |
| **Depends on** | T-088, T-089, T-092 |
| **Blocks** | T-095 |

## Problem

P&L statement PDF must present the money truth already computed by analytics (revenue, costs, profit, orders, series, top products, category share) with both tables and charts, and stream as `application/pdf`.

## Goal

Implement `renderPnlPdf(data, currency): Promise<Buffer>` that produces a complete, paginated PDF ready for `Content-Disposition: attachment`.

## Scope

- Sections in order: cover (title "P&L Statement", `Range [from,to) UTC`, `Generated {now} UTC`, `by usr_*` + currency badge), KPI 4-up (Revenue / Costs / Profit / Orders), Revenue table (`product_revenue`, `collected_total`, `shipping_collected`, `tax_collected`, `discounts_given`, `refunded_total`), Costs table (COGS, `operating_expenses`, `operating_expenses GROUP BY category` via `findOpexByCategory`, `total_costs`), Profit table (`gross_profit`, `net_profit`, `net_margin_pct`), Orders KPIs (`count`, `avg_order_value`, `discounted_orders_pct`, `coupons_redeemed`, `repeat_purchase_pct`), Series line chart (revenue vs costs) + table (`bucket_start`, `product_revenue`, `costs`), Top Products 8 (rank, name, units, revenue, cogs, margin), Category Share table + pie chart, footnote: "COGS uses current cost_price — historical snapshot TODO" + customers / sales_quality appendix.
- Charts via `src/shared/pdf/charts.ts` (`renderSeriesLineChart`, `renderCategorySharePie`) with `Promise.all` parallel; if chart `Buffer` is `null`, render tables only with a small notice.
- Use `src/shared/pdf/format.ts` `formatMoney(value, currency)` for every money cell/axis label.
- Disclaimer page if `product_revenue === 0`.

## Acceptance criteria

- [x] `renderPnlPdf` returns `Buffer` starting with `%PDF-` for a 30-day window, with 2 charts embedded when canvas is available.
- [x] Tables paginate; no money cell leaks internal `id`; public `exp_` ids only in opex detail rows.
- [x] Renders in < 2s for a 30-day window in tests.

## Implementation notes (2026-08-31)

- Created `src/modules/reports/service/pdf.service.ts` with `renderPnlPdf` (KPIs, revenue/costs/profit, byCategory bar, series line, top products, category pie + tables) using shared pdf vector charts.

## References

- `src/modules/analytics/dto/analytics.ts:1`, `src/shared/pdf/builder.ts` (T-089), `prisma/schema.prisma:278` (`product_variants.cost_price`)
