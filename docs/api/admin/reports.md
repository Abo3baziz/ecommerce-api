# Reports API (PDF + JSON preview)

Financial PDFs for SUPER_ADMIN — P&L, Expenses, Revenue — by calendar period with configurable currency and browser-downloadable `Content-Disposition`. All endpoints require a `SUPER_ADMIN` session; `ADMIN` receives `403`.

```
GET /api/v1/admin/reports/pnl?period=&year=&month=&quarter=&date_from=&date_to=&granularity=&currency=&disposition=&format=&category=
GET /api/v1/admin/reports/pnl.pdf?...)          alias
GET /api/v1/admin/reports/expenses?...)
GET /api/v1/admin/reports/expenses.pdf?...)     alias
GET /api/v1/admin/reports/revenue?...)
GET /api/v1/admin/reports/revenue.pdf?...)      alias
```

## Query params

| Param | Type | Notes |
|-------|------|-------|
| `period` | `month\|quarter\|year\|custom` | default `custom` |
| `year` | `2000..2100` | required if `period` is `month|quarter|year` |
| `month` | `1..12` | required if `period=month` |
| `quarter` | `1..4` | required if `period=quarter` (`1=Jan,2=Apr,3=Jul,4=Oct`) |
| `date_from`,`date_to` | ISO datetime | required if `custom`; `from < to` and ≤366 days; rejected when `period != custom` |
| `granularity` | `auto\|day\|month` | default `auto` (`≤31d → day` else `month`) |
| `currency` | `USD\|EUR\|GBP\|EGP\|SAR\|AED` | default `USD`; affects `Intl.NumberFormat` formatting only |
| `disposition` | `attachment\|inline` | default `attachment` (`Content-Disposition` filename `pnl-*.pdf` etc.) |
| `format` | `pdf\|json` | `json` returns `{ success:true, data }` preview without PDF rendering |
| `category` | `RENT\|SALARIES\|...\|OTHER` | only `expenses` report, filters ledger rows |

Windows are half-open `[from, to)` in UTC; `orders.placed_at` uses exact `TIMESTAMPTZ`, `operating_expenses.spent_at` uses `BETWEEN from::date AND to::date`.

## Responses

- `200 application/pdf` — binary `%PDF-` with headers `Content-Type`, `Content-Length`, `Content-Disposition`, `Cache-Control: no-store`, `X-Report-Currency`.
- `200 application/json` when `?format=json` — same `data` shape as the PDF without rendering.
- `400` validation, `401` unauthenticated, `403` non-SUPER_ADMIN.

## P&L (`/pnl`)

`data`: `range`, `revenue` (`product_revenue = Σ(subtotal−discount)`, `collected_total`, `shipping_collected`, `tax_collected`, `discounts_given`, `refunded_total`), `costs` (`cogs = Σ quantity×current cost_price`, `operating_expenses`, `total_costs`, `byCategory`), `profit` (`gross_profit`, `net_profit`, `net_margin_pct`), `orders` (`count`, `avg_order_value`), `series` (zero-filled `day|month` buckets), `top_products[8]`, `category_share`, `customers`, `sales_quality`. PDF contains KPI grid, revenue/costs/profit tables, by-category bar, series line chart + table, top products, category pie. Footnote: COGS uses current variant cost price.

## Expenses (`/expenses`)

`data`: `range`, `totals` (`total`, `avgPerDay`, `count`), `byCategory` (category totals + share), `expenses[≤500]` (`public_id exp_*`, `description`, `category`, `amount`, `spent_at`, `created_by`). PDF: summary table + bar, detail table paginated. Filename `expenses-{label}.pdf`.

## Revenue (`/revenue`)

`data`: `range`, `revenue` (`product_revenue`, `collected_total`, `refunded_total`, `discounts_given`), `orders`, `series`, `top_products`, `category_share`. PDF: summary, series line, top products, category pie. Filename `revenue-{label}.pdf`.

## Notes

- Money stays `Prisma.Decimal → string` at DTO; PDF formats via `Intl.NumberFormat` with `currency`. No internal `id` is exposed — only `public_id` (`exp_*`, `prd_*`, `cat_*`).
- Streaming only; no persistence. Audit via `auditAdminMutations` if configured.
- Charts are pure pdfkit vector (line/bar/pie); no native `canvas` dependency required.
