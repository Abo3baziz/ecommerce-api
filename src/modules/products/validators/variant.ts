import { z } from "zod";
import { product_status } from "../../../generated/prisma/enums.js";
import {
  booleanQuery,
  dimensionField,
  discountField,
  moneyField,
  paginationQuery,
  publicIdParam,
  sortQuery,
} from "./common.js";

const VARIANT_SORT_FIELDS = ["sku", "price", "created_at", "updated_at"] as const;

const skuField = z.string().trim().min(1).max(80);
const barcodeField = z.string().trim().max(255);
const colorField = z.string().trim().max(50);
const sizeField = z.string().trim().max(50);
const statusField = z.enum([
  product_status.ACTIVE,
  product_status.DRAFT,
  product_status.INACTIVE,
  product_status.ARCHIVED,
] as const);

export const createVariantSchema = z.object({
  params: z.object({
    product_public_id: publicIdParam,
  }),
  body: z.object({
    sku: skuField,
    barcode: barcodeField.optional(),
    color: colorField.optional(),
    size: sizeField.optional(),
    price: moneyField,
    cost_price: moneyField.optional(),
    discount_percentage: discountField.optional(),
    weight: dimensionField.optional(),
    length: dimensionField.optional(),
    width: dimensionField.optional(),
    height: dimensionField.optional(),
    status: statusField.optional(),
  }),
});

export type CreateVariantBody = z.infer<typeof createVariantSchema.shape.body>;

export const updateVariantSchema = z.object({
  params: z.object({
    product_public_id: publicIdParam,
    variant_public_id: publicIdParam,
  }),
  body: z.object({
    sku: skuField.optional(),
    barcode: barcodeField.nullish(),
    color: colorField.nullish(),
    size: sizeField.nullish(),
    price: moneyField.optional(),
    cost_price: moneyField.nullish(),
    discount_percentage: discountField.optional(),
    weight: dimensionField.nullish(),
    length: dimensionField.nullish(),
    width: dimensionField.nullish(),
    height: dimensionField.nullish(),
    status: statusField.nullish(),
  }),
});

export type UpdateVariantBody = z.infer<typeof updateVariantSchema.shape.body>;

export const variantParamsSchema = z.object({
  params: z.object({
    product_public_id: publicIdParam,
    variant_public_id: publicIdParam,
  }),
});

export type VariantParams = z.infer<typeof variantParamsSchema.shape.params>;

export const listVariantsSchema = z.object({
  params: z.object({
    product_public_id: publicIdParam,
  }),
  query: z.object({
    ...paginationQuery,
    status: statusField.optional(),
    include_deleted: booleanQuery(false),
    sort: sortQuery(VARIANT_SORT_FIELDS, "created_at"),
  }),
});

export type ListVariantsQuery = z.infer<typeof listVariantsSchema.shape.query>;
