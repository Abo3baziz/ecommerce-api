import { z } from "zod";
import {
  ADMIN_ORDER_SORT_FIELDS,
  orderPublicIdParam,
  orderStatusQuery,
  paginationQuery,
  searchQuery,
  sortQuery,
  ORDER_STATUS_VALUES,
} from "./common.js";

const orderStatusField = z.enum(ORDER_STATUS_VALUES);

const carrierField = z.string().trim().min(1).max(100);

const trackingNumberField = z.string().trim().max(100);

export const listAdminOrdersSchema = z.object({
  query: z
    .object({
      ...paginationQuery,
      status: orderStatusQuery,
      search: searchQuery,
      placed_from: z.string().datetime({ offset: true }).optional(),
      placed_to: z.string().datetime({ offset: true }).optional(),
      sort: sortQuery(ADMIN_ORDER_SORT_FIELDS, "-placed_at"),
    })
    .refine(
      (query) =>
        !query.placed_from ||
        !query.placed_to ||
        Date.parse(query.placed_from) <= Date.parse(query.placed_to),
      {
        message: "placed_from must not be after placed_to",
        path: ["placed_from"],
      },
    ),
});

export type ListAdminOrdersQuery = z.infer<
  typeof listAdminOrdersSchema.shape.query
>;

export const adminOrderParamsSchema = z.object({
  params: z.object({
    order_public_id: orderPublicIdParam,
  }),
});

export type AdminOrderParams = z.infer<
  typeof adminOrderParamsSchema.shape.params
>;

export const updateOrderStatusSchema = z.object({
  params: z.object({
    order_public_id: orderPublicIdParam,
  }),
  body: z
    .object({
      status: orderStatusField,
      carrier: carrierField.optional(),
      tracking_number: trackingNumberField.optional(),
    })
    .superRefine((body, ctx) => {
      if (body.status === "shipped" && body.carrier === undefined) {
        ctx.addIssue({
          code: "custom",
          message: "carrier is required when transitioning to shipped",
          path: ["carrier"],
        });
      }
    }),
});

export type UpdateOrderStatusBody = z.infer<
  typeof updateOrderStatusSchema.shape.body
>;
