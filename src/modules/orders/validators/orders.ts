import { z } from "zod";
import {
  orderPublicIdParam,
  orderStatusQuery,
  paginationQuery,
  sortQuery,
  ORDER_SORT_FIELDS,
} from "./common.js";

export const placeOrderSchema = z.object({
  body: z.object({
    address_public_id: z.string().min(1),
    payment_method: z.literal("mock"),
    coupon_code: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .transform((value) => value.toUpperCase())
      .optional(),
    notes: z.string().trim().max(1000).optional(),
  }),
});

export type PlaceOrderBody = z.infer<typeof placeOrderSchema.shape.body>;

export const listOrdersSchema = z.object({
  query: z.object({
    ...paginationQuery,
    status: orderStatusQuery,
    sort: sortQuery(ORDER_SORT_FIELDS, "-placed_at"),
  }),
});

export type ListOrdersQuery = z.infer<typeof listOrdersSchema.shape.query>;

export const orderParamsSchema = z.object({
  params: z.object({
    order_public_id: orderPublicIdParam,
  }),
});

export type OrderParams = z.infer<typeof orderParamsSchema.shape.params>;
