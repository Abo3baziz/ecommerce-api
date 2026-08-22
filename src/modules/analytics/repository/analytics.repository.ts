import { dbSchema, prisma } from "../../../config/database.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { expense_category } from "../../../generated/prisma/enums.js";

// Raw SQL aggregates: multi-table joins with FILTER/GROUP BY semantics that
// exceed Prisma's typed aggregate inputs. Identifiers are schema-qualified
// because the adapter only qualifies generated queries.
const ordersTable = Prisma.raw(`"${dbSchema}"."orders"`);
const orderItemsTable = Prisma.raw(`"${dbSchema}"."order_items"`);
const variantsTable = Prisma.raw(`"${dbSchema}"."product_variants"`);
const productsTable = Prisma.raw(`"${dbSchema}"."products"`);
const productCategoriesTable = Prisma.raw(`"${dbSchema}"."product_categories"`);
const categoriesTable = Prisma.raw(`"${dbSchema}"."categories"`);
const usersTable = Prisma.raw(`"${dbSchema}"."users"`);
const couponUsagesTable = Prisma.raw(`"${dbSchema}"."coupon_usages"`);
const operatingExpensesTable = Prisma.raw(
  `"${dbSchema}"."operating_expenses"`,
);

export interface RangeWindow {
  from: Date;
  to: Date;
}

// Recognized revenue basis: placed in range, not cancelled and not refunded.
// Refunded orders are reported separately via findRefundedTotal.
const qualifyingStatuses = Prisma.sql`o.status NOT IN ('CANCELLED', 'REFUNDED')`;
const rangeFilter = (window: RangeWindow): Prisma.Sql =>
  Prisma.sql`o.placed_at >= ${window.from} AND o.placed_at < ${window.to}`;

interface RevenueTotalsRow {
  order_count: number;
  product_revenue: Prisma.Decimal;
  collected_total: Prisma.Decimal;
  shipping_collected: Prisma.Decimal;
  tax_collected: Prisma.Decimal;
  discounts_given: Prisma.Decimal;
  discounted_orders: number;
}

interface ScalarRow {
  total: Prisma.Decimal;
}

interface CogsRow {
  cogs: Prisma.Decimal;
}

interface SeriesRow {
  bucket_start: Date;
  product_revenue: Prisma.Decimal;
  collected_total: Prisma.Decimal;
}

interface OpexSeriesRow {
  spent_at: Date;
  total: Prisma.Decimal;
}

interface TopProductRow {
  product_public_id: string;
  name: string;
  slug: string;
  units: number;
  revenue: Prisma.Decimal;
  cogs: Prisma.Decimal;
}

interface CategoryShareRow {
  category_public_id: string;
  name: string;
  revenue: Prisma.Decimal;
}

interface CustomerRepeatRow {
  repeat_customers: number;
  total_customers: number;
}

interface CountRow {
  count: number;
}

export const analyticsRepository = {
  async findRevenueTotals(window: RangeWindow): Promise<RevenueTotalsRow> {
    const [row] = await prisma.$queryRaw<RevenueTotalsRow[]>`
      SELECT
        COUNT(*)::int AS order_count,
        COALESCE(SUM(o.subtotal - o.discount_amount), 0) AS product_revenue,
        COALESCE(SUM(o.total_amount), 0) AS collected_total,
        COALESCE(SUM(o.shipping_fee), 0) AS shipping_collected,
        COALESCE(SUM(o.tax_amount), 0) AS tax_collected,
        COALESCE(SUM(o.discount_amount), 0) AS discounts_given,
        COUNT(*) FILTER (WHERE o.discount_amount > 0)::int AS discounted_orders
      FROM ${ordersTable} o
      WHERE ${rangeFilter(window)} AND ${qualifyingStatuses}
    `;
    return row;
  },

  async findRefundedTotal(window: RangeWindow): Promise<ScalarRow["total"]> {
    const [row] = await prisma.$queryRaw<ScalarRow[]>`
      SELECT COALESCE(SUM(total_amount), 0) AS total
      FROM ${ordersTable} o
      WHERE ${rangeFilter(window)} AND o.status = 'REFUNDED'
    `;
    return row.total;
  },

  // Uses the CURRENT variant cost price; historical cost snapshots are a
  // documented future enhancement.
  async findCogs(window: RangeWindow): Promise<CogsRow["cogs"]> {
    const [row] = await prisma.$queryRaw<CogsRow[]>`
      SELECT COALESCE(SUM(oi.quantity * COALESCE(v.cost_price, 0)), 0) AS cogs
      FROM ${orderItemsTable} oi
      JOIN ${ordersTable} o ON o.id = oi.orders_id
      JOIN ${variantsTable} v ON v.id = oi.product_variants_id
      WHERE ${rangeFilter(window)} AND ${qualifyingStatuses}
    `;
    return row.cogs;
  },

  async findRevenueSeries(window: RangeWindow): Promise<SeriesRow[]> {
    return prisma.$queryRaw<SeriesRow[]>`
      SELECT
        date_trunc('day', o.placed_at) AS bucket_start,
        COALESCE(SUM(o.subtotal - o.discount_amount), 0) AS product_revenue,
        COALESCE(SUM(o.total_amount), 0) AS collected_total
      FROM ${ordersTable} o
      WHERE ${rangeFilter(window)} AND ${qualifyingStatuses}
      GROUP BY 1
      ORDER BY 1
    `;
  },

  async findOpexSeries(
    window: RangeWindow,
  ): Promise<OpexSeriesRow[]> {
    // spent_at is a plain date column: bind bounds with explicit ::date casts
    // so Postgres compares day-to-day (an untyped param would otherwise be
    // inferred as date and exclude the boundary day).
    return prisma.$queryRaw<OpexSeriesRow[]>`
      SELECT e.spent_at::date AS spent_at, COALESCE(SUM(e.amount), 0) AS total
      FROM ${operatingExpensesTable} e
      WHERE e.spent_at BETWEEN ${window.from}::date AND ${window.to}::date
      GROUP BY 1
      ORDER BY 1
    `;
  },

  async findOpexTotal(window: RangeWindow): Promise<ScalarRow["total"]> {
    const [row] = await prisma.$queryRaw<ScalarRow[]>`
      SELECT COALESCE(SUM(amount), 0) AS total
      FROM ${operatingExpensesTable}
      WHERE spent_at BETWEEN ${window.from}::date AND ${window.to}::date
    `;
    return row.total;
  },

  async findTopProducts(
    window: RangeWindow,
    limit: number,
  ): Promise<TopProductRow[]> {
    return prisma.$queryRaw<TopProductRow[]>`
      SELECT
        p.public_id AS product_public_id,
        p.name,
        p.slug,
        SUM(oi.quantity)::int AS units,
        COALESCE(SUM(oi.total_amount), 0) AS revenue,
        COALESCE(SUM(oi.quantity * COALESCE(v.cost_price, 0)), 0) AS cogs
      FROM ${orderItemsTable} oi
      JOIN ${ordersTable} o ON o.id = oi.orders_id
      JOIN ${variantsTable} v ON v.id = oi.product_variants_id
      JOIN ${productsTable} p ON p.id = v.products_id
      WHERE ${rangeFilter(window)} AND ${qualifyingStatuses}
        AND oi.deleted_at IS NULL
      GROUP BY p.public_id, p.name, p.slug
      ORDER BY revenue DESC
      LIMIT ${limit}
    `;
  },

  async findCategoryShare(
    window: RangeWindow,
  ): Promise<CategoryShareRow[]> {
    return prisma.$queryRaw<CategoryShareRow[]>`
      SELECT
        cat.public_id AS category_public_id,
        cat.name,
        COALESCE(SUM(oi.total_amount), 0) AS revenue
      FROM ${orderItemsTable} oi
      JOIN ${ordersTable} o ON o.id = oi.orders_id
      JOIN ${variantsTable} v ON v.id = oi.product_variants_id
      JOIN ${productCategoriesTable} pc ON pc.products_id = v.products_id
      JOIN ${categoriesTable} cat ON cat.id = pc.categories_id
      WHERE ${rangeFilter(window)} AND ${qualifyingStatuses}
        AND oi.deleted_at IS NULL
      GROUP BY cat.public_id, cat.name
      ORDER BY revenue DESC
    `;
  },

  async findCustomerCounts(window: RangeWindow): Promise<{
    total_active: number;
    new_in_range: number;
  }> {
    const [row] = await prisma.$queryRaw<{
      total_active: number;
      new_in_range: number;
    }[]>`
      SELECT
        COUNT(*) FILTER (
          WHERE u.role = 'CUSTOMER' AND u.status = 'ACTIVE' AND u.deleted_at IS NULL
        )::int AS total_active,
        COUNT(*) FILTER (
          WHERE u.role = 'CUSTOMER' AND u.status = 'ACTIVE' AND u.deleted_at IS NULL
            AND u.created_at >= ${window.from} AND u.created_at < ${window.to}
        )::int AS new_in_range
      FROM ${usersTable} u
    `;
    return row;
  },

  async findCustomerRepeat(window: RangeWindow): Promise<CustomerRepeatRow> {
    const [row] = await prisma.$queryRaw<CustomerRepeatRow[]>`
      WITH per_customer AS (
        SELECT o.users_id, COUNT(*) AS order_count
        FROM ${ordersTable} o
        JOIN ${usersTable} u ON u.id = o.users_id
        WHERE u.role = 'CUSTOMER'
          AND ${rangeFilter(window)}
          AND ${qualifyingStatuses}
        GROUP BY o.users_id
      )
      SELECT
        COUNT(*) FILTER (WHERE order_count >= 2)::int AS repeat_customers,
        COUNT(*)::int AS total_customers
      FROM per_customer
    `;
    return row;
  },

  async countCouponsRedeemed(window: RangeWindow): Promise<number> {
    const [row] = await prisma.$queryRaw<CountRow[]>`
      SELECT COUNT(*)::int AS count
      FROM ${couponUsagesTable} cu
      JOIN ${ordersTable} o ON o.id = cu.orders_id
      WHERE ${rangeFilter(window)} AND ${qualifyingStatuses}
    `;
    return row.count;
  },
};

export const expensesRepository = {
  create(
    data: {
      public_id: string;
      description: string;
      category: expense_category;
      amount: Prisma.Decimal;
      spent_at: Date;
      created_by_users_id: number;
    },
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    const now = new Date();
    return client.operating_expenses.create({
      data: { ...data, created_at: now, updated_at: now },
      select: expenseSelect,
    });
  },

  findByPublicId(public_id: string) {
    return prisma.operating_expenses.findUnique({
      where: { public_id },
      select: expenseSelect,
    });
  },

  update(
    id: number,
    data: {
      description?: string;
      category?: expense_category;
      amount?: Prisma.Decimal;
      spent_at?: Date;
    },
  ) {
    return prisma.operating_expenses.update({
      where: { id },
      data: { ...data, updated_at: new Date() },
      select: expenseSelect,
    });
  },

  remove(id: number) {
    return prisma.operating_expenses.delete({ where: { id } });
  },

  list(
    filters: {
      category?: expense_category;
      from?: Date;
      to?: Date;
    },
    skip: number,
    take: number,
  ) {
    return prisma.operating_expenses.findMany({
      where: buildExpenseWhere(filters),
      orderBy: [{ spent_at: "desc" }, { id: "desc" }],
      skip,
      take,
      select: expenseSelect,
    });
  },

  async count(filters: {
    category?: expense_category;
    from?: Date;
    to?: Date;
  }): Promise<number> {
    return prisma.operating_expenses.count({ where: buildExpenseWhere(filters) });
  },
};

const expenseSelect = {
  id: true,
  public_id: true,
  description: true,
  category: true,
  amount: true,
  spent_at: true,
  created_by_users_id: true,
  users: {
    select: { first_name: true, last_name: true },
  },
  created_at: true,
  updated_at: true,
} satisfies Prisma.operating_expensesSelect;

export type ExpenseRow = Prisma.operating_expensesGetPayload<{
  select: typeof expenseSelect;
}>;

function buildExpenseWhere(filters: {
  category?: expense_category;
  from?: Date;
  to?: Date;
}): Prisma.operating_expensesWhereInput {
  const where: Prisma.operating_expensesWhereInput = {};
  if (filters.category) {
    where.category = filters.category;
  }
  if (filters.from || filters.to) {
    where.spent_at = {};
    if (filters.from) {
      where.spent_at.gte = filters.from;
    }
    if (filters.to) {
      where.spent_at.lt = filters.to;
    }
  }
  return where;
}
