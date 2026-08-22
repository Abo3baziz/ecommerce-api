import type { StatsPeriodPreset } from "../validators/admin.js";

export interface StatsPeriodMeta {
  preset: StatsPeriodPreset;
  from: string;
  to: string;
  bucket: "hour" | "day";
}

export interface StatsRevenue {
  gross_total: string;
  net_total: string;
  refunded_total: string;
  order_count: number;
  avg_order_value: string;
}

export interface StatsSeriesPoint {
  bucket_start: string;
  gross: string;
  net: string;
}

export type OrderStatus = "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "RETURNED" | "REFUNDED";

export type OrdersByStatus = Record<OrderStatus, number>;

export interface StatsTopProduct {
  product_public_id: string;
  name: string;
  slug: string;
  units: number;
  revenue: string;
}

export interface StatsStockHealth {
  low_stock_count: number;
  out_of_stock_count: number;
}

export interface StatsCustomers {
  total_active: number;
  new_in_period: number;
}

export interface StatsReviews {
  pending_moderation_count: number;
}

export interface AdminStatsPayload {
  period: StatsPeriodMeta;
  revenue: StatsRevenue;
  series: StatsSeriesPoint[];
  orders_by_status: OrdersByStatus;
  top_products: StatsTopProduct[];
  stock_health: StatsStockHealth;
  customers: StatsCustomers;
  reviews: StatsReviews;
}
