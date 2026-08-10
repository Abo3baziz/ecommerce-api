import { z } from "zod";
import { ORDER_STATUS, PAGINATION } from "../../../shared/constants/index.js";

export const ORDER_STATUS_VALUES = [
  ORDER_STATUS.PENDING,
  ORDER_STATUS.CONFIRMED,
  ORDER_STATUS.PROCESSING,
  ORDER_STATUS.SHIPPED,
  ORDER_STATUS.DELIVERED,
  ORDER_STATUS.CANCELLED,
  ORDER_STATUS.RETURNED,
  ORDER_STATUS.REFUNDED,
] as const;

export const ORDER_SORT_FIELDS = [
  "placed_at",
  "order_number",
  "total_amount",
] as const;

export const ADMIN_ORDER_SORT_FIELDS = [
  "placed_at",
  "order_number",
  "total_amount",
  "customer_name",
] as const;

export const pageQuery = z.coerce
  .number()
  .int()
  .min(1)
  .default(PAGINATION.DEFAULT_PAGE);

export const limitQuery = z.coerce
  .number()
  .int()
  .min(1)
  .max(PAGINATION.MAX_LIMIT)
  .default(PAGINATION.DEFAULT_LIMIT);

export const paginationQuery = {
  page: pageQuery,
  limit: limitQuery,
} as const;

export function sortQuery(
  allowedFields: readonly string[],
  defaultValue: string,
) {
  return z
    .string()
    .refine(
      (value) => {
        const field = value.startsWith("-") ? value.slice(1) : value;
        return allowedFields.includes(field);
      },
      { message: "Invalid sort field" },
    )
    .default(defaultValue);
}

export const orderStatusQuery = z.enum(ORDER_STATUS_VALUES).optional();

export const searchQuery = z.string().trim().optional();

export const orderPublicIdParam = z.string().min(1);
