import { z } from "zod";
import { productPublicIdParam } from "./common.js";

export const productReviewsParamsSchema = z.object({
  params: z.object({
    product_public_id: productPublicIdParam,
  }),
});

export type ProductReviewParams = z.infer<
  typeof productReviewsParamsSchema.shape.params
>;
