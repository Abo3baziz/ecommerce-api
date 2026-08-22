import { dbSchema, prisma } from "../../../config/database.js";
import { Prisma } from "../../../generated/prisma/client.js";
import type { OrderStatus } from "../types/stats.js";

// Raw SQL aggregates. Bucketing (`date_trunc`) and the FILTER-based conditional
// counts cannot be expressed with Prisma's typed aggregate inputs, so raw
// queries are used. Identifiers are schema-qualified because the adapter only
// qualifies generated queries.
const ordersTable = Prisma.raw(`"${dbSchema}"."orders"`);
const orderItemsTable = Prisma.raw(`"${dbSchema}"."order_items"`);
const variantsTable = Prisma.raw(`"${dbSchema}"."product_variants"`);
const productsTable = Prisma.raw(`"${dbSchema}"."products"`);
const inventoryTable = Prisma.raw(`"${dbSchema}"."inventory"`);
const usersTable = Prisma.raw(`"${dbSchema}"."users"`);
const reviewsTable = Prisma.raw(`"${dbSchema}"."reviews"`);

export interface PeriodBounds {
  from: Date;
  to: Date;
}

export type SeriesGranularity = "hour" | "day";

interface RevenueTotalsRow {
  order_count: number;
  gross: Prisma.Decimal;
  refunded: Prisma.Decimal;
}

interface SeriesRow {
  bucket_start: Date;
  gross: Prisma.Decimal;
  refunded: Prisma.Decimal;
}

interface StatusCountRow {
  status: OrderStatus;
  count: number;
}

interface TopProductRow {
  product_public_id: string;
  name: string;
  slug: string;
  units: number;
  revenue: Prisma.Decimal;
}

interface StockHealthRow {
  out_of_stock_count: number;
  low_stock_count: number;
}

interface CustomersRow {
  total_active: number;
  new_in_period: number;
}

interface PendingReviewsRow {
  count: number;
}

function periodWindow(bounds: PeriodBounds): Prisma.Sql {
  return Prisma.sql`placed_at >= ${bounds.from} AND placed_at < ${bounds.to}`;
}

// Mirrors the inventory module's derived stock-status expressions exactly
// (see src/modules/inventory/repository/inventory.repository.ts).
const quantityAvailableExpr = Prisma.sql`(i.quantity_on_hand - COALESCE(i.quantity_reserved, 0))`;

export const statsRepository = {
  async findRevenueTotals(bounds: PeriodBounds): Promise<RevenueTotalsRow> {
    const [row] = await prisma.$queryRaw<RevenueTotalsRow[]>`
      SELECT
        COUNT(*)::int AS order_count,
        COALESCE(SUM(total_amount), 0) AS gross,
        COALESCE(SUM(CASE WHEN status = 'REFUNDED' THEN total_amount ELSE 0 END), 0) AS refunded
      FROM ${ordersTable}
      WHERE ${periodWindow(bounds)}
        AND status <> 'CANCELLED'
    `;
    return row;
  },

  async findRevenueSeries(
    bounds: PeriodBounds,
    granularity: SeriesGranularity,
  ): Promise<SeriesRow[]> {
    // The truncation unit must be a string literal; it is an internal enum
    // value ("hour" | "day"), never user input.
    const truncUnit = Prisma.raw(`'${granularity}'`);
    return prisma.$queryRaw<SeriesRow[]>`
      SELECT
        date_trunc(${truncUnit}, placed_at) AS bucket_start,
        COALESCE(SUM(total_amount), 0) AS gross,
        COALESCE(SUM(CASE WHEN status = 'REFUNDED' THEN total_amount ELSE 0 END), 0) AS refunded
      FROM ${ordersTable}
      WHERE ${periodWindow(bounds)}
        AND status <> 'CANCELLED'
      GROUP BY 1
      ORDER BY 1
    `;
  },

  async findOrderCountsByStatus(bounds: PeriodBounds): Promise<StatusCountRow[]> {
    return prisma.$queryRaw<StatusCountRow[]>`
      SELECT status, COUNT(*)::int AS count
      FROM ${ordersTable}
      WHERE ${periodWindow(bounds)}
      GROUP BY status
    `;
  },

  async findTopProducts(
    bounds: PeriodBounds,
    limit: number,
  ): Promise<TopProductRow[]> {
    return prisma.$queryRaw<TopProductRow[]>`
      SELECT
        p.public_id AS product_public_id,
        p.name,
        p.slug,
        SUM(oi.quantity)::int AS units,
        COALESCE(SUM(oi.total_amount), 0) AS revenue
      FROM ${orderItemsTable} oi
      JOIN ${ordersTable} o ON o.id = oi.orders_id
      JOIN ${variantsTable} v ON v.id = oi.product_variants_id
      JOIN ${productsTable} p ON p.id = v.products_id
      WHERE o.placed_at >= ${bounds.from} AND o.placed_at < ${bounds.to}
        AND o.status <> 'CANCELLED'
        AND oi.deleted_at IS NULL
      GROUP BY p.public_id, p.name, p.slug
      ORDER BY revenue DESC
      LIMIT ${limit}
    `;
  },

  async findStockHealth(): Promise<StockHealthRow> {
    const [row] = await prisma.$queryRaw<StockHealthRow[]>`
      SELECT
        COUNT(*) FILTER (WHERE ${quantityAvailableExpr} <= 0)::int AS out_of_stock_count,
        COUNT(*) FILTER (
          WHERE ${quantityAvailableExpr} > 0
            AND i.reorder_level IS NOT NULL
            AND ${quantityAvailableExpr} <= i.reorder_level
        )::int AS low_stock_count
      FROM ${inventoryTable} i
      JOIN ${variantsTable} v ON v.id = i.product_variants_id
      WHERE v.deleted_at IS NULL
    `;
    return row;
  },

  async findCustomerCounts(bounds: PeriodBounds): Promise<CustomersRow> {
    const [row] = await prisma.$queryRaw<CustomersRow[]>`
      SELECT
        COUNT(*) FILTER (
          WHERE role = 'CUSTOMER' AND status = 'ACTIVE' AND deleted_at IS NULL
        )::int AS total_active,
        COUNT(*) FILTER (
          WHERE role = 'CUSTOMER' AND status = 'ACTIVE' AND deleted_at IS NULL
            AND created_at >= ${bounds.from} AND created_at < ${bounds.to}
        )::int AS new_in_period
      FROM ${usersTable}
    `;
    return row;
  },

  async countPendingReviews(): Promise<PendingReviewsRow["count"]> {
    const [row] = await prisma.$queryRaw<PendingReviewsRow[]>`
      SELECT COUNT(*)::int AS count
      FROM ${reviewsTable}
      WHERE is_approved = false AND deleted_at IS NULL
    `;
    return row.count;
  },
};
