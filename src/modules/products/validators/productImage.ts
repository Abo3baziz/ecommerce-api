import { z } from "zod";
import {
  displayOrderField,
  imageUrlField,
  paginationQuery,
  publicIdParam,
} from "./common.js";

const altTextField = z.string().trim().max(255);

export const createProductImageSchema = z.object({
  params: z.object({
    product_public_id: publicIdParam,
  }),
  body: z.object({
    image_url: imageUrlField,
    alt_text: altTextField.optional(),
    display_order: displayOrderField.optional(),
    is_primary: z.boolean().optional(),
  }),
});

export type CreateProductImageBody = z.infer<typeof createProductImageSchema.shape.body>;

export const updateProductImageSchema = z.object({
  params: z.object({
    product_public_id: publicIdParam,
    image_public_id: publicIdParam,
  }),
  body: z.object({
    image_url: imageUrlField.optional(),
    alt_text: altTextField.nullish(),
    display_order: displayOrderField.optional(),
    is_primary: z.boolean().optional(),
  }),
});

export type UpdateProductImageBody = z.infer<typeof updateProductImageSchema.shape.body>;

export const productImageParamsSchema = z.object({
  params: z.object({
    product_public_id: publicIdParam,
    image_public_id: publicIdParam,
  }),
});

export type ProductImageParams = z.infer<typeof productImageParamsSchema.shape.params>;

export const listProductImagesSchema = z.object({
  params: z.object({
    product_public_id: publicIdParam,
  }),
  query: z.object(paginationQuery),
});

export type ListProductImagesQuery = z.infer<typeof listProductImagesSchema.shape.query>;
