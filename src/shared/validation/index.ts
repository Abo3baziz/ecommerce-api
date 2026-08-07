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

export function createEnumSchema<T extends readonly [string, ...string[]]>(values: T) {
  return z.enum(values);
}
