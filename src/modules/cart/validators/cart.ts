import { z } from "zod";

export const MAX_CART_ITEM_QUANTITY = 999;

export const variantPublicIdField = z.string().min(1);

export const quantityField = z
  .number()
  .int()
  .min(1)
  .max(MAX_CART_ITEM_QUANTITY);

export const addCartItemSchema = z.object({
  body: z.object({
    variant_public_id: variantPublicIdField,
    quantity: quantityField.default(1),
  }),
});

export type AddCartItemBody = z.infer<typeof addCartItemSchema.shape.body>;

export const cartItemParamsSchema = z.object({
  params: z.object({
    variant_public_id: variantPublicIdField,
  }),
});

export type CartItemParams = z.infer<typeof cartItemParamsSchema.shape.params>;

export const updateCartItemSchema = z.object({
  params: z.object({
    variant_public_id: variantPublicIdField,
  }),
  body: z.object({
    quantity: quantityField,
  }),
});

export type UpdateCartItemBody = z.infer<typeof updateCartItemSchema.shape.body>;
