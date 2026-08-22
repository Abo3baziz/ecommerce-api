import { Prisma } from "../../../generated/prisma/client.js";
import {
  analyticsRepository,
  type RangeWindow,
} from "../repository/analytics.repository.js";
import type {
  AnalyticsOverviewPayload,
  AnalyticsSeriesPoint,
} from "../dto/analytics.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

export function resolveOverviewWindow(
  from?: Date,
  to?: Date,
  now: Date = new Date(),
): RangeWindow & { endExclusive: Date } {
  const endDate = to ?? now;
  const startDate = from ?? startOfUtcDay(new Date(now.getTime() - 29 * DAY_MS));
  return { from: startDate, to: endDate, endExclusive: endDate };
}

function decimal(value: Prisma.Decimal): string {
  return value.toString();
}

// The connection timezone is pinned to UTC, so day buckets align exactly with
// steps from the truncated start (same approach as the stats module).
function buildSeries(
  window: { from: Date; to: Date },
  revenueRows: Awaited<
    ReturnType<typeof analyticsRepository.findRevenueSeries>
  >,
  opexRows: Awaited<ReturnType<typeof analyticsRepository.findOpexSeries>>,
): AnalyticsSeriesPoint[] {
  const revenueByBucket = new Map<number, Prisma.Decimal[]>();
  for (const row of revenueRows) {
    revenueByBucket.set(row.bucket_start.getTime(), [
      new Prisma.Decimal(row.product_revenue),
      new Prisma.Decimal(row.collected_total),
    ]);
  }
  const opexByDay = new Map<number, Prisma.Decimal>();
  for (const row of opexRows) {
    opexByDay.set(row.spent_at.getTime(), new Prisma.Decimal(row.total));
  }

  const points: AnalyticsSeriesPoint[] = [];
  for (
    let t = startOfUtcDay(window.from).getTime();
    t < window.to.getTime();
    t += DAY_MS
  ) {
    const [productRevenue, collectedTotal] = revenueByBucket.get(t) ?? [
      new Prisma.Decimal(0),
      new Prisma.Decimal(0),
    ];
    const opex =
      opexByDay.get(t) ?? opexByDay.get(startOfUtcDay(new Date(t)).getTime());
    points.push({
      bucket_start: new Date(t).toISOString(),
      product_revenue: decimal(productRevenue),
      collected_total: decimal(collectedTotal),
      costs: decimal(opex ?? new Prisma.Decimal(0)),
    });
  }
  return points;
}

export async function getAnalyticsOverview(
  rangeFrom?: Date,
  rangeTo?: Date,
  now: Date = new Date(),
): Promise<AnalyticsOverviewPayload> {
  const { from, to, endExclusive } = resolveOverviewWindow(
    rangeFrom,
    rangeTo,
    now,
  );
  const window: RangeWindow = { from, to: endExclusive };

  const [
    revenueTotals,
    refundedTotal,
    cogs,
    revenueSeries,
    opexSeries,
    opexTotal,
    topProducts,
    categoryShare,
    customerCounts,
    customerRepeat,
    couponsRedeemed,
  ] = await Promise.all([
    analyticsRepository.findRevenueTotals(window),
    analyticsRepository.findRefundedTotal(window),
    analyticsRepository.findCogs(window),
    analyticsRepository.findRevenueSeries(window),
    analyticsRepository.findOpexSeries(window),
    analyticsRepository.findOpexTotal(window),
    analyticsRepository.findTopProducts(window, 8),
    analyticsRepository.findCategoryShare(window),
    analyticsRepository.findCustomerCounts(window),
    analyticsRepository.findCustomerRepeat(window),
    analyticsRepository.countCouponsRedeemed(window),
  ]);

  const productRevenue = new Prisma.Decimal(revenueTotals.product_revenue);
  const collectedTotal = new Prisma.Decimal(revenueTotals.collected_total);
  const cogsDecimal = new Prisma.Decimal(cogs);
  const opexDecimal = new Prisma.Decimal(opexTotal);
  const totalCosts = cogsDecimal.plus(opexDecimal);
  const grossProfit = productRevenue.minus(cogsDecimal);
  const netProfit = grossProfit.minus(opexDecimal);
  const netMarginPct = productRevenue.isZero()
    ? new Prisma.Decimal(0)
    : netProfit.div(productRevenue).mul(100).toDecimalPlaces(2);

  const orderCount = revenueTotals.order_count;
  const aov =
    orderCount > 0
      ? collectedTotal.div(orderCount).toDecimalPlaces(2)
      : new Prisma.Decimal(0);

  const discountedOrdersPct =
    orderCount > 0
      ? new Prisma.Decimal(revenueTotals.discounted_orders)
          .div(orderCount)
          .mul(100)
          .toDecimalPlaces(1)
      : new Prisma.Decimal(0);

  const repeatPurchasePct =
    customerRepeat.total_customers > 0
      ? new Prisma.Decimal(customerRepeat.repeat_customers)
          .div(customerRepeat.total_customers)
          .mul(100)
          .toDecimalPlaces(1)
      : new Prisma.Decimal(0);

  const categoryShareTotal = categoryShare.reduce(
    (sum, row) => sum.add(row.revenue),
    new Prisma.Decimal(0),
  );

  return {
    range: { from: from.toISOString(), to: endExclusive.toISOString() },
    revenue: {
      product_revenue: decimal(productRevenue),
      collected_total: decimal(collectedTotal),
      shipping_collected: decimal(new Prisma.Decimal(revenueTotals.shipping_collected)),
      tax_collected: decimal(new Prisma.Decimal(revenueTotals.tax_collected)),
      discounts_given: decimal(new Prisma.Decimal(revenueTotals.discounts_given)),
      refunded_total: decimal(new Prisma.Decimal(refundedTotal)),
    },
    costs: {
      cogs: decimal(cogsDecimal),
      operating_expenses: decimal(opexDecimal),
      total_costs: decimal(totalCosts),
    },
    profit: {
      gross_profit: decimal(grossProfit),
      net_profit: decimal(netProfit),
      net_margin_pct: decimal(netMarginPct),
    },
    orders: {
      count: orderCount,
      avg_order_value: decimal(aov),
    },
    series: buildSeries({ from, to: endExclusive }, revenueSeries, opexSeries),
    top_products: topProducts.map((row) => {
      const revenue = new Prisma.Decimal(row.revenue);
      const margin = revenue.isZero()
        ? new Prisma.Decimal(0)
        : revenue.minus(row.cogs).div(revenue).mul(100).toDecimalPlaces(1);
      return {
        product_public_id: row.product_public_id,
        name: row.name,
        slug: row.slug,
        units: row.units,
        revenue: decimal(revenue),
        cogs: decimal(new Prisma.Decimal(row.cogs)),
        gross_margin_pct: decimal(margin),
      };
    }),
    category_share: categoryShare.map((row) => ({
      category_public_id: row.category_public_id,
      name: row.name,
      revenue: decimal(new Prisma.Decimal(row.revenue)),
      share_pct: categoryShareTotal.isZero()
        ? "0"
        : decimal(
            new Prisma.Decimal(row.revenue)
              .div(categoryShareTotal)
              .mul(100)
              .toDecimalPlaces(1),
          ),
    })),
    customers: {
      total_active: customerCounts.total_active,
      new_in_range: customerCounts.new_in_range,
      repeat_purchase_pct: decimal(repeatPurchasePct),
    },
    sales_quality: {
      discounted_orders_pct: decimal(discountedOrdersPct),
      coupons_redeemed: couponsRedeemed,
    },
  };
}
