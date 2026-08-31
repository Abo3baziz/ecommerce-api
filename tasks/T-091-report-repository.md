# T-091 — Report repository + opex by category

| Field | Value |
|-------|-------|
| **ID** | T-091 |
| **Priority** | P2 |
| **Status** | done |
| **Type** | `feature` |
| **Branch** | `feature/reports-pdf` |
| **Depends on** | — |
| **Blocks** | T-092 |

## Problem

Reports need the same P&L aggregates as `src/modules/analytics/repository/analytics.repository.ts` (533 lines, raw SQL) plus an `operating_expenses GROUP BY category` breakdown. No report-specific repository exists.

## Goal

Create `src/modules/reports/repository/report.repository.ts` that reuses `analyticsRepository` and adds the category breakdown without duplicating SQL.

## Scope

- Re-export/ delegate to `analyticsRepository` for: `findRevenueTotals`, `findCogs`, `findOpexTotal`, `findRefundedTotal`, `findRevenueSeries(trunc)`, `findOpexSeries`, `findTopProducts(8)`, `findCategoryShare`, `findCustomerCounts`, `countCouponsRedeemed`, `listExpenses`-style queries.
- Add `findOpexByCategory(from: Date, to: Date): Promise<{ category: string, total: Prisma.Decimal }[]>`:
  ```sql
  SELECT category, SUM(amount) AS total
  FROM "Ecommerce"."operating_expenses"
  WHERE spent_at BETWEEN $1::date AND $2::date
  GROUP BY category ORDER BY total DESC
  ```
- Keep `DbClient = Prisma.TransactionClient | typeof prisma` signature for unit/integration testability.
- Use schema-qualified `Ecommerce.operating_expenses`; rely on existing `idx_operating_expenses_spent_at`.

## Acceptance criteria

- [x] `findOpexByCategory` returns 0..7 rows with correct `Prisma.Decimal` totals; `EXPLAIN` shows index usage.
- [x] No SQL duplication — delegations cover P&L totals; new query only for category breakdown.

## Implementation notes (2026-08-31)

- Created `src/modules/reports/repository/report.repository.ts` with `findOpexByCategory` + `findExpensesList`/`countExpenses` helpers; analytics aggregates imported directly from `analyticsRepository` in the service layer.

## References

- `src/modules/analytics/repository/analytics.repository.ts:1`, `prisma/schema.prisma:589` (`operating_expenses`), `prisma/migrations/20260824000002_query_indexes/migration.sql:1`
