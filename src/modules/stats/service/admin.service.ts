import { Prisma } from "../../../generated/prisma/client.js";
import {
  statsRepository,
  type PeriodBounds,
  type SeriesGranularity,
} from "../repository/stats.repository.js";
import type {
  AdminStatsPayload,
  OrdersByStatus,
  StatsPeriodMeta,
  StatsSeriesPoint,
} from "../types/stats.js";
import type { StatsPeriodPreset } from "../validators/admin.js";

const TOP_PRODUCTS_LIMIT = 5;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function resolvePeriod(preset: StatsPeriodPreset, now: Date): {
  bounds: PeriodBounds;
  meta: Omit<StatsPeriodMeta, "from" | "to">;
  granularity: SeriesGranularity;
} {
  if (preset === "today") {
    return {
      bounds: { from: startOfUtcDay(now), to: now },
      meta: { preset, bucket: "hour" },
      granularity: "hour",
    };
  }

  const days = preset === "7d" ? 7 : 30;
  const from = startOfUtcDay(new Date(now.getTime() - (days - 1) * DAY_MS));
  return {
    bounds: { from, to: now },
    meta: { preset, bucket: "day" },
    granularity: "day",
  };
}

function decimalToString(value: Prisma.Decimal): string {
  return value.toString();
}

// The connection timezone is pinned to UTC (`-c timezone=UTC`) so `date_trunc`
// buckets land on exact hour/day boundaries; stepping from the truncated start
// therefore matches every bucket without drift.
function buildSeries(
  bounds: PeriodBounds,
  granularity: SeriesGranularity,
  rows: Awaited<ReturnType<typeof statsRepository.findRevenueSeries>>,
): StatsSeriesPoint[] {
  const stepMs = granularity === "hour" ? HOUR_MS : DAY_MS;
  const byBucket = new Map<number, Prisma.Decimal[]>();
  for (const row of rows) {
    byBucket.set(row.bucket_start.getTime(), [
      new Prisma.Decimal(row.gross),
      new Prisma.Decimal(row.refunded),
    ]);
  }

  const points: StatsSeriesPoint[] = [];
  for (let t = bounds.from.getTime(); t < bounds.to.getTime(); t += stepMs) {
    const [gross, refunded] = byBucket.get(t) ?? [
      new Prisma.Decimal(0),
      new Prisma.Decimal(0),
    ];
    points.push({
      bucket_start: new Date(t).toISOString(),
      gross: decimalToString(gross),
      net: decimalToString(gross.minus(refunded)),
    });
  }
  return points;
}

function buildOrdersByStatus(
  rows: Awaited<ReturnType<typeof statsRepository.findOrderCountsByStatus>>,
): OrdersByStatus {
  const counts: OrdersByStatus = {
    PENDING: 0,
    CONFIRMED: 0,
    PROCESSING: 0,
    SHIPPED: 0,
    DELIVERED: 0,
    CANCELLED: 0,
    RETURNED: 0,
    REFUNDED: 0,
  };
  for (const row of rows) {
    counts[row.status] = row.count;
  }
  return counts;
}

export async function getAdminStats(
  preset: StatsPeriodPreset,
  now: Date = new Date(),
): Promise<AdminStatsPayload> {
  const { bounds, meta, granularity } = resolvePeriod(preset, now);

  const [
    revenueTotals,
    seriesRows,
    statusRows,
    topProductRows,
    stockHealth,
    customers,
    pendingReviewsCount,
  ] = await Promise.all([
    statsRepository.findRevenueTotals(bounds),
    statsRepository.findRevenueSeries(bounds, granularity),
    statsRepository.findOrderCountsByStatus(bounds),
    statsRepository.findTopProducts(bounds, TOP_PRODUCTS_LIMIT),
    statsRepository.findStockHealth(),
    statsRepository.findCustomerCounts(bounds),
    statsRepository.countPendingReviews(),
  ]);

  const gross = new Prisma.Decimal(revenueTotals.gross);
  const refunded = new Prisma.Decimal(revenueTotals.refunded);
  const orderCount = revenueTotals.order_count;
  const avgOrderValue =
    orderCount > 0
      ? gross.div(orderCount).toDecimalPlaces(2)
      : new Prisma.Decimal(0);

  return {
    period: {
      ...meta,
      from: bounds.from.toISOString(),
      to: bounds.to.toISOString(),
    },
    revenue: {
      gross_total: decimalToString(gross),
      net_total: decimalToString(gross.minus(refunded)),
      refunded_total: decimalToString(refunded),
      order_count: orderCount,
      avg_order_value: decimalToString(avgOrderValue),
    },
    series: buildSeries(bounds, granularity, seriesRows),
    orders_by_status: buildOrdersByStatus(statusRows),
    top_products: topProductRows.map((row) => ({
      product_public_id: row.product_public_id,
      name: row.name,
      slug: row.slug,
      units: row.units,
      revenue: decimalToString(row.revenue),
    })),
    stock_health: {
      low_stock_count: stockHealth.low_stock_count,
      out_of_stock_count: stockHealth.out_of_stock_count,
    },
    customers,
    reviews: { pending_moderation_count: pendingReviewsCount },
  };
}
