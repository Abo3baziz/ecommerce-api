import { z } from "zod";
import {
  commentField,
  imagesField,
  paginationQuery,
  productPublicIdParam,
  ratingField,
  ratingQuery,
  reviewPublicIdParam,
  sortQuery,
  titleField,
  REVIEW_SORT_FIELDS,
} from "./common.js";

export const createReviewSchema = z.object({
  body: z.object({
    product_public_id: productPublicIdParam,
    rating: ratingField,
    title: titleField.optional(),
    comment: commentField.optional(),
    images: imagesField.optional(),
  }),
});

export type CreateReviewBody = z.infer<typeof createReviewSchema.shape.body>;

export const listProductReviewsSchema = z.object({
  params: z.object({
    product_public_id: productPublicIdParam,
  }),
  query: z.object({
    ...paginationQuery,
    rating: ratingQuery,
    sort: sortQuery(REVIEW_SORT_FIELDS, "-created_at"),
  }),
});

export type ListProductReviewsQuery = z.infer<
  typeof listProductReviewsSchema.shape.query
>;

export const reviewParamsSchema = z.object({
  params: z.object({
    review_public_id: reviewPublicIdParam,
  }),
});

export type ReviewParams = z.infer<typeof reviewParamsSchema.shape.params>;

export const updateReviewSchema = z.object({
  params: z.object({
    review_public_id: reviewPublicIdParam,
  }),
  body: z
    .object({
      rating: ratingField.optional(),
      title: titleField.nullish(),
      comment: commentField.nullish(),
      images: imagesField.optional(),
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: "At least one field must be provided",
    }),
});

export type UpdateReviewBody = z.infer<typeof updateReviewSchema.shape.body>;

export const listOwnReviewsSchema = z.object({
  query: z.object({
    ...paginationQuery,
    sort: sortQuery(REVIEW_SORT_FIELDS, "-created_at"),
  }),
});

export type ListOwnReviewsQuery = z.infer<
  typeof listOwnReviewsSchema.shape.query
>;
