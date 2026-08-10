import { z } from "zod";
import {
  booleanQuery,
  commentField,
  paginationQuery,
  ratingField,
  ratingQuery,
  reviewPublicIdParam,
  searchQuery,
  sortQuery,
  titleField,
  REVIEW_SORT_FIELDS,
} from "./common.js";

export const listAdminReviewsSchema = z.object({
  query: z.object({
    ...paginationQuery,
    search: searchQuery,
    rating: ratingQuery,
    is_approved: z
      .enum(["true", "false", "all"])
      .transform((value) =>
        value === "all" ? undefined : value === "true",
      )
      .optional(),
    include_deleted: booleanQuery(false),
    sort: sortQuery(REVIEW_SORT_FIELDS, "-created_at"),
  }),
});

export type ListAdminReviewsQuery = z.infer<
  typeof listAdminReviewsSchema.shape.query
>;

export const adminReviewParamsSchema = z.object({
  params: z.object({
    review_public_id: reviewPublicIdParam,
  }),
});

export type AdminReviewParams = z.infer<
  typeof adminReviewParamsSchema.shape.params
>;

export const moderateReviewSchema = z.object({
  params: z.object({
    review_public_id: reviewPublicIdParam,
  }),
  body: z
    .object({
      is_approved: z.boolean().optional(),
      rating: ratingField.optional(),
      title: titleField.nullish(),
      comment: commentField.nullish(),
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: "At least one field must be provided",
    }),
});

export type ModerateReviewBody = z.infer<typeof moderateReviewSchema.shape.body>;
