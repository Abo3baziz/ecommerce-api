import { Prisma } from "../../../generated/prisma/client.js";
import { analyticsRepository } from "../../analytics/repository/analytics.repository.js";
import type { RangeWindow } from "../../analytics/repository/analytics.repository.js";
import { findOpexByCategory, findRevenueSeriesTruncated, findOpexSeriesTruncated } from "../repository/report.repository.js";
import type { ReportQuery } from "../validators/admin.js";
import type { ReportWindow } from "../dto/reports.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcMonth(year: number, month: number): Date {
  return new Date(Date.UTC(year, month - 1, 1));
}

function addMonths(date: Date, n: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + n, 1));
}

export function resolveReportWindow(query: ReportQuery, now: Date = new Date()): ReportWindow {
  let from: Date;
  let to: Date;
  let label: string;

  if (query.period === "month") {
    const y = query.year as number;
    const m = query.month as number;
    from = startOfUtcMonth(y, m);
    to = addMonths(from, 1);
    label = `${y}-${String(m).padStart(2, "0")}`;
  } else if (query.period === "quarter") {
    const y = query.year as number;
    const q = query.quarter as number;
    const month = (q - 1) * 3 + 1;
    from = startOfUtcMonth(y, month);
    to = addMonths(from, 3);
    label = `${y} Q${q}`;
  } else if (query.period === "year") {
    const y = query.year as number;
    from = new Date(Date.UTC(y, 0, 1));
    to = new Date(Date.UTC(y + 1, 0, 1));
    label = String(y);
  } else {
    // custom
    from = query.date_from as Date;
    to = query.date_to as Date;
    const f = startOfUtcDay(from).toISOString().slice(0, 10);
    const t = startOfUtcDay(to).toISOString().slice(0, 10);
    void now;
    label = `${f} to ${t}`;
  }

  const days = (to.getTime() - from.getTime()) / DAY_MS;
  let bucket: "day" | "month";
  if (query.granularity === "day" || query.granularity === "month") {
    bucket = query.granularity;
  } else {
    bucket = days <= 31 ? "day" : "month";
  }

  return { from, to, label, bucket, period: query.period };
}

function decimal(value: Prisma.Decimal): string {
  return value.toString();
}

function buildSeries(
  window: RangeWindow,
  bucket: "day" | "month",
  revenueRows: { bucket_start: Date; product_revenue: Prisma.Decimal; collected_total: Prisma.Decimal }[],
  opexRows: { spent_at: Date; total: Prisma.Decimal }[],
): { bucket_start: string; product_revenue: string; collected_total: string; costs: string }[] {
  const revenueByBucket = new Map<number, Prisma.Decimal[]>();
  for (const row of revenueRows) {
    revenueByBucket.set(row.bucket_start.getTime(), [
      new Prisma.Decimal(row.product_revenue),
      new Prisma.Decimal(row.collected_total),
    ]);
  }
  const opexByBucket = new Map<number, Prisma.Decimal>();
  for (const row of opexRows) {
    // normalize to bucket start (for month, spent_at already truncated to month)
    const key = row.spent_at.getTime();
    // monthly buckets have day 1; ensure we store as is
    opexByBucket.set(key, new Prisma.Decimal(row.total));
  }

  const points: { bucket_start: string; product_revenue: string; collected_total: string; costs: string }[] = [];

  if (bucket === "day") {
    for (let t = startOfUtcDay(window.from).getTime(); t < window.to.getTime(); t += DAY_MS) {
      const [pr, ct] = revenueByBucket.get(t) ?? [new Prisma.Decimal(0), new Prisma.Decimal(0)];
      const costs = opexByBucket.get(t) ?? new Prisma.Decimal(0);
      points.push({
        bucket_start: new Date(t).toISOString(),
        product_revenue: decimal(pr),
        collected_total: decimal(ct),
        costs: decimal(costs),
      });
    }
  } else {
    // month bucket: iterate month starts from window.from (aligned to month)
    let cur = startOfUtcMonth(window.from.getUTCFullYear(), window.from.getUTCMonth() + 1);
    // Align start to window.from month start
    cur = startOfUtcMonth(window.from.getUTCFullYear(), window.from.getUTCMonth() + 1 - 0);
    // Actually simpler: iterate months from truncated window.from
    let iter = new Date(Date.UTC(window.from.getUTCFullYear(), window.from.getUTCMonth(), 1));
    while (iter.getTime() < window.to.getTime()) {
      const key = iter.getTime();
      const [pr, ct] = revenueByBucket.get(key) ?? [new Prisma.Decimal(0), new Prisma.Decimal(0)];
      const costs = opexByBucket.get(key) ?? new Prisma.Decimal(0);
      points.push({
        bucket_start: iter.toISOString(),
        product_revenue: decimal(pr),
        collected_total: decimal(ct),
        costs: decimal(costs),
      });
      iter = addMonths(iter, 1);
    }
  }
  return points;
}

export interface PnlData {
  window: ReportWindow;
  range: { from: string; to: string };
  revenue: {
    product_revenue: string;
    collected_total: string;
    shipping_collected: string;
    tax_collected: string;
    discounts_given: string;
    refunded_total: string;
  };
  costs: {
    cogs: string;
    operating_expenses: string;
    total_costs: string;
    byCategory: { category: string; total: string }[];
  };
  profit: { gross_profit: string; net_profit: string; net_margin_pct: string };
  orders: { count: number; avg_order_value: string };
  series: { bucket_start: string; product_revenue: string; collected_total: string; costs: string }[];
  top_products: {
    product_public_id: string;
    name: string;
    slug: string;
    units: number;
    revenue: string;
    cogs: string;
    gross_margin_pct: string;
  }[];
  category_share: { category_public_id: string; name: string; revenue: string; share_pct: string }[];
  customers: { total_active: number; new_in_range: number; repeat_purchase_pct: string };
  sales_quality: { discounted_orders_pct: string; coupons_redeemed: number };
}

export async function getPnlData(query: ReportQuery, now: Date = new Date()): Promise<PnlData> {
  const window = resolveReportWindow(query, now);
  const rangeWindow: RangeWindow = { from: window.from, to: window.to };

  const [
    revenueTotals,
    refundedTotal,
    cogs,
    revenueSeries,
    opexSeries,
    opexTotal,
    opexByCategory,
    topProducts,
    categoryShare,
    customerCounts,
    customerRepeat,
    couponsRedeemed,
  ] = await Promise.all([
    analyticsRepository.findRevenueTotals(rangeWindow),
    analyticsRepository.findRefundedTotal(rangeWindow),
    analyticsRepository.findCogs(rangeWindow),
    findRevenueSeriesTruncated(rangeWindow, window.bucket),
    findOpexSeriesTruncated(rangeWindow, window.bucket),
    analyticsRepository.findOpexTotal(rangeWindow),
    findOpexByCategory(rangeWindow),
    analyticsRepository.findTopProducts(rangeWindow, 8),
    analyticsRepository.findCategoryShare(rangeWindow),
    analyticsRepository.findCustomerCounts(rangeWindow),
    analyticsRepository.findCustomerRepeat(rangeWindow),
    analyticsRepository.countCouponsRedeemed(rangeWindow),
  ]);

  const productRevenue = new Prisma.Decimal(revenueTotals.product_revenue);
  const collectedTotal = new Prisma.Decimal(revenueTotals.collected_total);
  const cogsDecimal = new Prisma.Decimal(cogs);
  const opexDecimal = new Prisma.Decimal(opexTotal);
  const totalCosts = cogsDecimal.plus(opexDecimal);
  const grossProfit = productRevenue.minus(cogsDecimal);
  const netProfit = grossProfit.minus(opexDecimal);
  const netMarginPct = productRevenue.isZero() ? new Prisma.Decimal(0) : netProfit.div(productRevenue).mul(100).toDecimalPlaces(2);
  const orderCount = revenueTotals.order_count;
  const aov = orderCount > 0 ? collectedTotal.div(orderCount).toDecimalPlaces(2) : new Prisma.Decimal(0);
  const discountedPct =
    orderCount > 0
      ? new Prisma.Decimal(revenueTotals.discounted_orders).div(orderCount).mul(100).toDecimalPlaces(1)
      : new Prisma.Decimal(0);
  const repeatPct =
    customerRepeat.total_customers > 0
      ? new Prisma.Decimal(customerRepeat.repeat_customers).div(customerRepeat.total_customers).mul(100).toDecimalPlaces(1)
      : new Prisma.Decimal(0);
  const categoryShareTotal = categoryShare.reduce((s, r) => s.add(r.revenue), new Prisma.Decimal(0));

  return {
    window,
    range: { from: window.from.toISOString(), to: window.to.toISOString() },
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
      byCategory: opexByCategory.map((r) => ({ category: r.category, total: decimal(new Prisma.Decimal(r.total)) })),
    },
    profit: { gross_profit: decimal(grossProfit), net_profit: decimal(netProfit), net_margin_pct: decimal(netMarginPct) },
    orders: { count: orderCount, avg_order_value: decimal(aov) },
    series: buildSeries(rangeWindow, window.bucket, revenueSeries, opexSeries),
    top_products: topProducts.map((row) => {
      const rev = new Prisma.Decimal(row.revenue);
      const margin = rev.isZero() ? new Prisma.Decimal(0) : rev.minus(row.cogs).div(rev).mul(100).toDecimalPlaces(1);
      return {
        product_public_id: row.product_public_id,
        name: row.name,
        slug: row.slug,
        units: row.units,
        revenue: decimal(rev),
        cogs: decimal(new Prisma.Decimal(row.cogs)),
        gross_margin_pct: decimal(margin),
      };
    }),
    category_share: categoryShare.map((row) => ({
      category_public_id: row.category_public_id,
      name: row.name,
      revenue: decimal(new Prisma.Decimal(row.revenue)),
      share_pct: categoryShareTotal.isZero() ? "0" : decimal(new Prisma.Decimal(row.revenue).div(categoryShareTotal).mul(100).toDecimalPlaces(1)),
    })),
    customers: { total_active: customerCounts.total_active, new_in_range: customerCounts.new_in_range, repeat_purchase_pct: decimal(repeatPct) },
    sales_quality: { discounted_orders_pct: decimal(discountedPct), coupons_redeemed: couponsRedeemed },
  };
}

export interface ExpensesData {
  window: ReportWindow;
  range: { from: string; to: string };
  totals: { total: string; avgPerDay: string; count: number };
  byCategory: { category: string; total: string; share_pct: string }[];
  expenses: { public_id: string; description: string; category: string; amount: string; spent_at: string; created_by: string }[];
}

export async function getExpensesData(query: ReportQuery, now: Date = new Date()): Promise<ExpensesData> {
  const window = resolveReportWindow(query, now);
  const rangeWindow: RangeWindow = { from: window.from, to: window.to };
  const { findExpensesList, countExpenses } = await import("../repository/report.repository.js");
  const [total, byCategory, expenses, count] = await Promise.all([
    analyticsRepository.findOpexTotal(rangeWindow),
    findOpexByCategory(rangeWindow),
    findExpensesList(rangeWindow, query.category, 0, 500),
    countExpenses(rangeWindow, query.category),
  ]);
  const totalDec = new Prisma.Decimal(total);
  const days = Math.max(1, (window.to.getTime() - window.from.getTime()) / DAY_MS);
  const avg = totalDec.div(days).toDecimalPlaces(2);
  const byCat = byCategory.map((r) => ({
    category: r.category,
    total: decimal(new Prisma.Decimal(r.total)),
    share_pct: totalDec.isZero() ? "0" : decimal(new Prisma.Decimal(r.total).div(totalDec).mul(100).toDecimalPlaces(1)),
  }));
  return {
    window,
    range: { from: window.from.toISOString(), to: window.to.toISOString() },
    totals: { total: decimal(totalDec), avgPerDay: decimal(avg), count },
    byCategory: byCat,
    expenses: expenses.map((e) => ({
      public_id: e.public_id,
      description: e.description,
      category: e.category,
      amount: decimal(new Prisma.Decimal(e.amount)),
      spent_at: e.spent_at.toISOString().slice(0, 10),
      created_by: `${e.users.first_name} ${e.users.last_name}`.trim(),
    })),
  };
}

export interface RevenueData {
  window: ReportWindow;
  range: { from: string; to: string };
  revenue: {
    product_revenue: string;
    collected_total: string;
    refunded_total: string;
    discounts_given: string;
  };
  orders: { count: number; avg_order_value: string };
  series: { bucket_start: string; product_revenue: string; collected_total: string; costs: string }[];
  top_products: PnlData["top_products"];
  category_share: PnlData["category_share"];
}

export async function getRevenueData(query: ReportQuery, now: Date = new Date()): Promise<RevenueData> {
  const window = resolveReportWindow(query, now);
  const rangeWindow: RangeWindow = { from: window.from, to: window.to };
  const [revenueTotals, refundedTotal, revenueSeries, opexSeries, topProducts, categoryShare] = await Promise.all([
    analyticsRepository.findRevenueTotals(rangeWindow),
    analyticsRepository.findRefundedTotal(rangeWindow),
    findRevenueSeriesTruncated(rangeWindow, window.bucket),
    findOpexSeriesTruncated(rangeWindow, window.bucket),
    analyticsRepository.findTopProducts(rangeWindow, 8),
    analyticsRepository.findCategoryShare(rangeWindow),
  ]);
  const productRevenue = new Prisma.Decimal(revenueTotals.product_revenue);
  const collectedTotal = new Prisma.Decimal(revenueTotals.collected_total);
  const orderCount = revenueTotals.order_count;
  const aov = orderCount > 0 ? collectedTotal.div(orderCount).toDecimalPlaces(2) : new Prisma.Decimal(0);
  const categoryShareTotal = categoryShare.reduce((s, r) => s.add(r.revenue), new Prisma.Decimal(0));
  return {
    window,
    range: { from: window.from.toISOString(), to: window.to.toISOString() },
    revenue: {
      product_revenue: decimal(productRevenue),
      collected_total: decimal(collectedTotal),
      refunded_total: decimal(new Prisma.Decimal(refundedTotal)),
      discounts_given: decimal(new Prisma.Decimal(revenueTotals.discounts_given)),
    },
    orders: { count: orderCount, avg_order_value: decimal(aov) },
    series: buildSeries(rangeWindow, window.bucket, revenueSeries, opexSeries),
    top_products: topProducts.map((row) => {
      const rev = new Prisma.Decimal(row.revenue);
      const margin = rev.isZero() ? new Prisma.Decimal(0) : rev.minus(row.cogs).div(rev).mul(100).toDecimalPlaces(1);
      return {
        product_public_id: row.product_public_id,
        name: row.name,
        slug: row.slug,
        units: row.units,
        revenue: decimal(rev),
        cogs: decimal(new Prisma.Decimal(row.cogs)),
        gross_margin_pct: decimal(margin),
      };
    }),
    category_share: categoryShare.map((row) => ({
      category_public_id: row.category_public_id,
      name: row.name,
      revenue: decimal(new Prisma.Decimal(row.revenue)),
      share_pct: categoryShareTotal.isZero() ? "0" : decimal(new Prisma.Decimal(row.revenue).div(categoryShareTotal).mul(100).toDecimalPlaces(1)),
    })),
  };
}
