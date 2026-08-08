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

export const brandQuery = z.string().trim().optional();

export const publicIdParam = z.string().min(1);

export const slugField = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug format");

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

export const displayOrderField = z.number().int().min(0);

function decimalField(
  maxIntegerDigits: number,
  maxDecimalDigits: number,
  min: number,
  exclusiveMin = false,
  max?: number,
) {
  const pattern = new RegExp(`^\\d{1,${maxIntegerDigits}}(\\.\\d{1,${maxDecimalDigits}})?$`);
  return z
    .string()
    .trim()
    .refine(
      (value) => {
        if (!pattern.test(value)) {
          return false;
        }
        const numeric = Number(value);
        if (exclusiveMin ? numeric <= min : numeric < min) {
          return false;
        }
        if (max !== undefined && numeric > max) {
          return false;
        }
        return true;
      },
      { message: "Invalid decimal value" },
    );
}

export const moneyField = decimalField(10, 2, 0);

export const dimensionField = decimalField(10, 2, 0, true);

export const discountField = decimalField(5, 2, 0, false, 100);
