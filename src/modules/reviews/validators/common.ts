import { z } from "zod";
import { PAGINATION } from "../../../shared/constants/index.js";

export const REVIEW_SORT_FIELDS = ["created_at", "rating"] as const;

export const pageQuery = z.coerce
  .number()
  .int()
  .min(1)
  .default(PAGINATION.DEFAULT_PAGE);

export const limitQuery = z.coerce
  .number()
  .int()
  .min(1)
  .max(PAGINATION.MAX_LIMIT)
  .default(PAGINATION.DEFAULT_LIMIT);

export const paginationQuery = {
  page: pageQuery,
  limit: limitQuery,
} as const;

export function sortQuery(allowedFields: readonly string[], defaultValue: string) {
  return z
    .string()
    .refine(
      (value) => {
        const field = value.startsWith("-") ? value.slice(1) : value;
        return allowedFields.includes(field);
      },
      { message: "Invalid sort field" },
    )
    .default(defaultValue);
}

export const searchQuery = z.string().trim().optional();

export const reviewPublicIdParam = z.string().min(1);

export const productPublicIdParam = z.string().min(1);

export const ratingQuery = z.coerce.number().int().min(1).max(5).optional();

export const ratingField = z.number().int().min(1).max(5);

export const titleField = z.string().trim().max(255);

export const commentField = z.string().trim().max(5000);

export const altTextField = z.string().trim().max(255);

export const imageUrlField = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine(
    (value) => {
      try {
        const protocol = new URL(value).protocol;
        return protocol === "http:" || protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "image_url must be an absolute http or https URL" },
  );

export const reviewImageItemSchema = z.object({
  image_url: imageUrlField,
  alt_text: altTextField.optional(),
});

export const imagesField = z.array(reviewImageItemSchema).max(5);

export function booleanQuery(defaultValue: boolean) {
  return z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default(defaultValue);
}
