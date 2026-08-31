import { dbSchema, prisma } from "../../../config/database.js";
import { Prisma } from "../../../generated/prisma/client.js";
import type { RangeWindow } from "../../analytics/repository/analytics.repository.js";

const operatingExpensesTable = Prisma.raw(`"${dbSchema}"."operating_expenses"`);
const ordersTable = Prisma.raw(`"${dbSchema}"."orders"`);

export interface OpexCategoryTotal {
  category: string;
  total: Prisma.Decimal;
}

export async function findOpexByCategory(window: RangeWindow): Promise<OpexCategoryTotal[]> {
  return prisma.$queryRaw<OpexCategoryTotal[]>`
    SELECT category::text AS category, COALESCE(SUM(amount), 0) AS total
    FROM ${operatingExpensesTable}
    WHERE spent_at BETWEEN ${window.from}::date AND ${window.to}::date
    GROUP BY category
    ORDER BY total DESC
  `;
}

export async function findExpensesList(
  window: RangeWindow,
  category: string | undefined,
  skip: number,
  take: number,
) {
  const where: Prisma.operating_expensesWhereInput = {
    spent_at: { gte: window.from, lt: window.to },
  };
  if (category) (where as Record<string, unknown>).category = category;
  return prisma.operating_expenses.findMany({
    where,
    orderBy: [{ spent_at: "desc" }, { id: "desc" }],
    skip,
    take,
    select: {
      public_id: true,
      description: true,
      category: true,
      amount: true,
      spent_at: true,
      created_by_users_id: true,
      users: { select: { first_name: true, last_name: true } },
      created_at: true,
      updated_at: true,
    },
  });
}

export async function countExpenses(window: RangeWindow, category: string | undefined): Promise<number> {
  const where: Prisma.operating_expensesWhereInput = {
    spent_at: { gte: window.from, lt: window.to },
  };
  if (category) (where as Record<string, unknown>).category = category;
  return prisma.operating_expenses.count({ where });
}

export async function findRevenueSeriesTruncated(
  window: RangeWindow,
  trunc: "day" | "month",
): Promise<{ bucket_start: Date; product_revenue: Prisma.Decimal; collected_total: Prisma.Decimal }[]> {
  if (trunc === "month") {
    return prisma.$queryRaw<{ bucket_start: Date; product_revenue: Prisma.Decimal; collected_total: Prisma.Decimal }[]>`
      SELECT
        date_trunc('month', o.placed_at) AS bucket_start,
        COALESCE(SUM(o.subtotal - o.discount_amount), 0) AS product_revenue,
        COALESCE(SUM(o.total_amount), 0) AS collected_total
      FROM ${ordersTable} o
      WHERE o.placed_at >= ${window.from} AND o.placed_at < ${window.to}
        AND o.status NOT IN ('CANCELLED', 'REFUNDED')
      GROUP BY 1
      ORDER BY 1
    `;
  }
  return prisma.$queryRaw<{ bucket_start: Date; product_revenue: Prisma.Decimal; collected_total: Prisma.Decimal }[]>`
    SELECT
      date_trunc('day', o.placed_at) AS bucket_start,
      COALESCE(SUM(o.subtotal - o.discount_amount), 0) AS product_revenue,
      COALESCE(SUM(o.total_amount), 0) AS collected_total
    FROM ${ordersTable} o
    WHERE o.placed_at >= ${window.from} AND o.placed_at < ${window.to}
      AND o.status NOT IN ('CANCELLED', 'REFUNDED')
    GROUP BY 1
    ORDER BY 1
  `;
}

export async function findOpexSeriesTruncated(
  window: RangeWindow,
  trunc: "day" | "month",
): Promise<{ spent_at: Date; total: Prisma.Decimal }[]> {
  if (trunc === "month") {
    return prisma.$queryRaw<{ spent_at: Date; total: Prisma.Decimal }[]>`
      SELECT date_trunc('month', e.spent_at)::date AS spent_at, COALESCE(SUM(e.amount), 0) AS total
      FROM ${operatingExpensesTable} e
      WHERE e.spent_at BETWEEN ${window.from}::date AND ${window.to}::date
      GROUP BY 1
      ORDER BY 1
    `;
  }
  return prisma.$queryRaw<{ spent_at: Date; total: Prisma.Decimal }[]>`
    SELECT e.spent_at::date AS spent_at, COALESCE(SUM(e.amount), 0) AS total
    FROM ${operatingExpensesTable} e
    WHERE e.spent_at BETWEEN ${window.from}::date AND ${window.to}::date
    GROUP BY 1
    ORDER BY 1
  `;
}
