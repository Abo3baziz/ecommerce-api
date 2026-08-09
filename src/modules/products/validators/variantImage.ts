import { z } from "zod";
import {
  displayOrderField,
  imageUrlField,
  paginationQuery,
  publicIdParam,
} from "./common.js";

const altTextField = z.string().trim().max(255);

export const createVariantImageSchema = z.object({
  params: z.object({
    product_public_id: publicIdParam,
    variant_public_id: publicIdParam,
  }),
  body: z.object({
    image_url: imageUrlField,
    alt_text: altTextField.optional(),
    display_order: displayOrderField.optional(),
  }),
});

export type CreateVariantImageBody = z.infer<typeof createVariantImageSchema.shape.body>;

export const updateVariantImageSchema = z.object({
  params: z.object({
    product_public_id: publicIdParam,
    variant_public_id: publicIdParam,
    variant_image_public_id: publicIdParam,
  }),
  body: z.object({
    image_url: imageUrlField.optional(),
    alt_text: altTextField.nullish(),
    display_order: displayOrderField.optional(),
  }),
});

export type UpdateVariantImageBody = z.infer<typeof updateVariantImageSchema.shape.body>;

export const variantImageParamsSchema = z.object({
  params: z.object({
    product_public_id: publicIdParam,
    variant_public_id: publicIdParam,
    variant_image_public_id: publicIdParam,
  }),
});

export type VariantImageParams = z.infer<typeof variantImageParamsSchema.shape.params>;

export const listVariantImagesSchema = z.object({
  params: z.object({
    product_public_id: publicIdParam,
    variant_public_id: publicIdParam,
  }),
  query: z.object(paginationQuery),
});

export type ListVariantImagesQuery = z.infer<typeof listVariantImagesSchema.shape.query>;
