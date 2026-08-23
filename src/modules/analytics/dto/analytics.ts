import { Prisma } from "../../../generated/prisma/client.js";
import type { expense_category } from "../../../generated/prisma/enums.js";
import type { PaginationMeta } from "../../orders/dto/common.js";
import type { ExpenseRow } from "../repository/analytics.repository.js";

export interface AnalyticsRange {
  from: string;
  to: string;
}

export interface AnalyticsRevenue {
  product_revenue: string;
  collected_total: string;
  shipping_collected: string;
  tax_collected: string;
  discounts_given: string;
  refunded_total: string;
}

export interface AnalyticsCosts {
  cogs: string;
  operating_expenses: string;
  total_costs: string;
}

export interface AnalyticsProfit {
  gross_profit: string;
  net_profit: string;
  net_margin_pct: string;
}

export interface AnalyticsOrders {
  count: number;
  avg_order_value: string;
}

export interface AnalyticsSeriesPoint {
  bucket_start: string;
  product_revenue: string;
  collected_total: string;
  costs: string;
}

export interface AnalyticsTopProduct {
  product_public_id: string;
  name: string;
  slug: string;
  units: number;
  revenue: string;
  cogs: string;
  gross_margin_pct: string;
}

export interface AnalyticsCategoryShare {
  category_public_id: string;
  name: string;
  revenue: string;
  share_pct: string;
}

export interface AnalyticsCustomers {
  total_active: number;
  new_in_range: number;
  repeat_purchase_pct: string;
}

export interface AnalyticsSalesQuality {
  discounted_orders_pct: string;
  coupons_redeemed: number;
}

export interface AnalyticsOverviewPayload {
  range: AnalyticsRange;
  revenue: AnalyticsRevenue;
  costs: AnalyticsCosts;
  profit: AnalyticsProfit;
  orders: AnalyticsOrders;
  series: AnalyticsSeriesPoint[];
  top_products: AnalyticsTopProduct[];
  category_share: AnalyticsCategoryShare[];
  customers: AnalyticsCustomers;
  sales_quality: AnalyticsSalesQuality;
}

export type OperatingExpenseCategory = expense_category;

export interface OperatingExpenseResult {
  public_id: string;
  description: string;
  category: OperatingExpenseCategory;
  amount: string;
  spent_at: string;
  created_by: { id: number; name: string };
  created_at: Date;
  updated_at: Date;
}

export function toExpenseResult(
  row: ExpenseRow,
): OperatingExpenseResult {
  return {
    public_id: row.public_id,
    description: row.description,
    category: row.category as OperatingExpenseCategory,
    amount: new Prisma.Decimal(row.amount).toString(),
    spent_at: row.spent_at.toISOString().slice(0, 10),
    created_by: {
      id: row.created_by_users_id,
      name: `${row.users.first_name} ${row.users.last_name}`.trim(),
    },
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export interface ListExpensesResult {
  expenses: OperatingExpenseResult[];
  pagination: PaginationMeta;
}

export interface CouponAnalyticsTotals {
  total_coupons: number;
  active_coupons: number;
  inactive_coupons: number;
  expired_coupons: number;
  usage_limit_reached: number;
  lifetime_redemptions: number;
  range_redemptions: number;
  discounts_given_in_range: string;
  coupon_orders_count: number;
  coupon_orders_revenue: string;
  coupon_orders_share_pct: string;
}

export interface CouponAnalyticsMostUsed {
  coupon_public_id: string;
  code: string;
  discount_type: "FIXED_AMOUNT" | "PERCENTAGE";
  discount_value: string;
  is_active: boolean;
  lifetime_uses: number;
  range_redemptions: number;
  discounts_given_in_range: string;
}

export interface CouponAnalyticsTrendPoint {
  date: string;
  redemptions: number;
  discount_amount: string;
}

export interface CouponAnalyticsPayload {
  range: AnalyticsRange;
  totals: CouponAnalyticsTotals;
  most_used: CouponAnalyticsMostUsed[];
  trend: CouponAnalyticsTrendPoint[];
}
