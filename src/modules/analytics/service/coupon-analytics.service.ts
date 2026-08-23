import { Prisma } from "../../../generated/prisma/client.js";
import {
  couponAnalyticsRepository,
  analyticsRepository,
} from "../repository/analytics.repository.js";
import type {
  CouponAnalyticsMostUsed,
  CouponAnalyticsPayload,
  CouponAnalyticsTrendPoint,
} from "../dto/analytics.js";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function decimal(value: Prisma.Decimal): string {
  return value.toString();
}

export async function getCouponAnalytics(
  rangeFrom?: Date,
  rangeTo?: Date,
  now: Date = new Date(),
): Promise<CouponAnalyticsPayload> {
  const from = rangeFrom ?? startOfUtcDay(new Date(now.getTime() - 29 * DAY_MS));
  const to = rangeTo ?? now;
  const window = { from, to };

  const [
    statusCounts,
    rangeUsage,
    couponOrderRevenue,
    qualifyingOrders,
    mostUsedRows,
    trendRows,
  ] = await Promise.all([
    couponAnalyticsRepository.findStatusCounts(now),
    couponAnalyticsRepository.findRangeUsage(window),
    couponAnalyticsRepository.findCouponOrderRevenue(window),
    analyticsRepository.findQualifyingOrderCount(window),
    couponAnalyticsRepository.findMostUsed(window, 8),
    couponAnalyticsRepository.findUsageTrend(window),
  ]);

  // Trend buckets are date-typed redemptions; zero-fill every day in range.
  const byDay = new Map<number, { redemptions: number; amount: Prisma.Decimal }>();
  for (const row of trendRows) {
    byDay.set(row.date.getTime(), {
      redemptions: row.redemptions,
      amount: new Prisma.Decimal(row.discount_amount),
    });
  }
  const trend: CouponAnalyticsTrendPoint[] = [];
  for (
    let t = startOfUtcDay(from).getTime();
    t < to.getTime();
    t += DAY_MS
  ) {
    const match = byDay.get(t);
    trend.push({
      date: new Date(t).toISOString().slice(0, 10),
      redemptions: match?.redemptions ?? 0,
      discount_amount: decimal(match?.amount ?? new Prisma.Decimal(0)),
    });
  }

  const sharePct =
    qualifyingOrders > 0
      ? new Prisma.Decimal(couponOrderRevenue.orders)
          .div(qualifyingOrders)
          .mul(100)
          .toDecimalPlaces(1)
          .toString()
      : "0";

  return {
    range: { from: from.toISOString(), to: to.toISOString() },
    totals: {
      total_coupons: statusCounts.total_coupons,
      active_coupons: statusCounts.active_coupons,
      inactive_coupons: statusCounts.inactive_coupons,
      expired_coupons: statusCounts.expired_coupons,
      usage_limit_reached: statusCounts.usage_limit_reached,
      lifetime_redemptions: statusCounts.lifetime_redemptions,
      range_redemptions: rangeUsage.range_redemptions,
      discounts_given_in_range: decimal(rangeUsage.discounts_given_in_range),
      coupon_orders_count: couponOrderRevenue.orders,
      coupon_orders_revenue: decimal(couponOrderRevenue.revenue),
      coupon_orders_share_pct: sharePct,
    },
    most_used: mostUsedRows.map((row) => ({
      coupon_public_id: row.coupon_public_id,
      code: row.code,
      discount_type:
        row.discount_type === "FIXED_AMOUNT" ? "FIXED_AMOUNT" : "PERCENTAGE",
      discount_value: decimal(new Prisma.Decimal(row.discount_value)),
      is_active: row.is_active,
      lifetime_uses: row.lifetime_uses,
      range_redemptions: row.range_redemptions,
      discounts_given_in_range: decimal(
        new Prisma.Decimal(row.discounts_given_in_range),
      ),
    })),
    trend,
  };
}
