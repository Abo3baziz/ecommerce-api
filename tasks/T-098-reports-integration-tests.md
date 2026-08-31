# T-098 — Reports integration tests (pdf headers / auth)

| Field | Value |
|-------|-------|
| **ID** | T-098 |
| **Priority** | P2 |
| **Status** | done |
| **Type** | `test` |
| **Branch** | `feature/reports-pdf` |
| **Depends on** | T-095, T-096 |
| **Blocks** | T-099 |

## Problem

Reports endpoints must be proven to stream valid PDFs, enforce SUPER_ADMIN-only access, and obey period/currency/validation contracts.

## Goal

Add `tests/integration/reports.reports.spec.ts` (and e2e if needed) using real Postgres with `fileParallelism:false`, matching `tests/integration/analytics` patterns.

## Scope

- Seed via factories: at least 2 qualifying orders (`status NOT IN ('CANCELLED','REFUNDED')`) with `order_items` + `product_variants.cost_price`, plus 1 `operating_expenses` row (`exp_` `spent_at`) and 1 refunded order for totals sanity.
- Cases:
  - `SUPER_ADMIN` `GET /admin/reports/pnl.pdf?period=month&year=2026&month=8&currency=USD` → 200 `content-type: application/pdf; charset=binary` (or `application/pdf`), `content-disposition: attachment; filename="pnl-2026-08.pdf"` , body starts with `%PDF-`, `content-length` present.
  - `?period=quarter&year=2026&quarter=2` monthly buckets; `?period=year&year=2026`; `?period=custom&date_from=...&date_to=...`; `?disposition=inline` → `inline; filename=…`.
  - `?currency=EGP` renders (check header `X-Report-Currency: EGP`).
  - `period=month` without `month` → 400; `custom` without dates → 400; `from >= to` → 400; `>366d` → 400; `currency=XYZ` → 400; mixed `period=year&date_from` → 400.
  - `ADMIN` on same PDF route → 403; unauthenticated → 401 (mirrors `src/modules/analytics/routes/admin.routes.ts:28`).
  - `?format=json` → 200 `application/json` `{ success:true, data }` with decimal-string money (no PDF rendering).
- Use `supertest` against `src/app/index.ts` factory; reuse `tests/helpers/auth.ts` login helpers.

## Acceptance criteria

- [x] `vitest run` full suite (including new file) green; coverage does not regress below existing floor.
- [x] ≥ 15 supertest cases; at least 3 windows (month/quarter/custom) each produce a valid PDF header.

## Implementation notes (2026-08-31)

- Created `tests/integration/reports/reports.integration.test.ts` with 21 supertest cases: 401/403/400 validation (period/currency/mixing), 200 pdf for month/quarter/year/custom with `Content-Disposition`/`X-Report-Currency`/`%PDF-` checks, inline disposition, and `?format=json` preview for pnl/expenses/revenue. Verified `vitest run` green.

## References

- `tests/integration/` patterns, `src/modules/analytics/routes/admin.routes.ts:28`, `src/middleware/authorization.ts:1`, `src/app/index.ts:1`
