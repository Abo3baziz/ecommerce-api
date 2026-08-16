import { z } from "zod";
import { PAGINATION } from "../constants/index.js";

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(PAGINATION.DEFAULT_PAGE),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION.MAX_LIMIT)
    .default(PAGINATION.DEFAULT_LIMIT),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

export const passwordField = z
  .string()
  .min(8)
  .regex(
    passwordRegex,
    "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character",
  );

export function createEnumSchema<T extends readonly [string, ...string[]]>(values: T) {
  return z.enum(values);
}
