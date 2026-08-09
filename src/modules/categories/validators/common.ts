import { z } from "zod";
import { PAGINATION } from "../../../shared/constants/index.js";

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

export function booleanQuery(defaultValue: boolean) {
  return z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .default(defaultValue);
}

export function optionalBooleanQuery() {
  return z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional();
}

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

export const publicIdParam = z.string().min(1);

export const slugField = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format");
