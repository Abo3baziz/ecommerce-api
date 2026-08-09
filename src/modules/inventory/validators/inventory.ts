import { z } from "zod";
import {
  booleanQuery,
  paginationQuery,
  publicIdParam,
  searchQuery,
  sortQuery,
} from "./common.js";

const INVENTORY_SORT_FIELDS = [
  "product_name",
  "sku",
  "quantity_on_hand",
  "quantity_available",
  "last_stock_update",
] as const;

const STOCK_STATUSES = ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"] as const;

const quantityOnHandField = z.number().int().min(0);
const reorderLevelField = z.number().int().min(0);
const quantityChangeField = z
  .number()
  .int()
  .refine((value) => value !== 0, {
    message: "Quantity change must be non-zero",
  });

export const createInventorySchema = z.object({
  body: z.object({
    variant_public_id: publicIdParam,
    quantity_on_hand: quantityOnHandField,
    reorder_level: reorderLevelField.optional(),
  }),
});

export type CreateInventoryBody = z.infer<typeof createInventorySchema.shape.body>;

export const inventoryParamsSchema = z.object({
  params: z.object({
    variant_public_id: publicIdParam,
  }),
});

export type InventoryParams = z.infer<typeof inventoryParamsSchema.shape.params>;

export const updateInventorySchema = z.object({
  params: z.object({
    variant_public_id: publicIdParam,
  }),
  body: z
    .object({
      quantity_on_hand: quantityOnHandField.optional(),
      quantity_change: quantityChangeField.optional(),
      reorder_level: reorderLevelField.nullish(),
      reason: z.string().trim().max(255).optional(),
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: "At least one field is required",
    })
    .refine(
      (body) =>
        body.quantity_on_hand === undefined || body.quantity_change === undefined,
      {
        message: "quantity_on_hand and quantity_change are mutually exclusive",
      },
    ),
});

export type UpdateInventoryBody = z.infer<typeof updateInventorySchema.shape.body>;

export const listInventorySchema = z.object({
  query: z.object({
    ...paginationQuery,
    search: searchQuery,
    stock_status: z.enum(STOCK_STATUSES).optional(),
    include_deleted: booleanQuery(false),
    sort: sortQuery(INVENTORY_SORT_FIELDS, "product_name"),
  }),
});

export type ListInventoryQuery = z.infer<typeof listInventorySchema.shape.query>;
