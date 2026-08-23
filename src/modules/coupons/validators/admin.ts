import { z } from "zod";
import { publicIdParam } from "../shared/validators.js";

export const COUPON_STATUSES = [
  "ACTIVE",
  "INACTIVE",
  "EXPIRED",
  "USAGE_LIMIT_REACHED",
] as const;

export type CouponStatus = (typeof COUPON_STATUSES)[number];

const COUPON_SORT_FIELDS = [
  "code",
  "discount_value",
  "usage_count",
  "starts_at",
  "expires_at",
  "created_at",
] as const;

export const couponCodeField = z
  .string()
  .trim()
  .min(3)
  .max(50)
  .regex(/^[A-Za-z0-9_-]+$/, "Use letters, numbers, dashes or underscores")
  .transform((value) => value.toUpperCase());

export const listCouponsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(50).optional(),
    status: z.enum(COUPON_STATUSES).optional(),
    include_deleted: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    sort: z
      .string()
      .refine(
        (value) => {
          const field = value.startsWith("-") ? value.slice(1) : value;
          return COUPON_SORT_FIELDS.includes(
            field as (typeof COUPON_SORT_FIELDS)[number],
          );
        },
        { message: "Invalid sort field" },
      )
      .default("-created_at"),
  }),
});

export type ListCouponsQuery = z.infer<typeof listCouponsSchema.shape.query>;

export const createCouponSchema = z
  .object({
    body: z.object({
      code: couponCodeField,
      discount_type: z.enum(["FIXED_AMOUNT", "PERCENTAGE"]),
      discount_value: z.coerce.number().positive().max(100),
      minimum_order_amount: z.coerce.number().min(0).optional(),
      maximum_discount_amount: z.coerce.number().positive().optional(),
      usage_limit: z.coerce.number().int().min(1),
      usage_limit_per_user: z.coerce.number().int().min(1),
      starts_at: z.coerce.date().optional(),
      expires_at: z.coerce.date().optional(),
      is_active: z.boolean().default(true),
    }),
  })
  .refine(
    (data) =>
      data.body.starts_at === undefined ||
      data.body.expires_at === undefined ||
      data.body.expires_at > data.body.starts_at,
    { message: "expires_at must be after starts_at" },
  )
  .refine(
    (data) =>
      data.body.discount_type !== "PERCENTAGE" ||
      data.body.discount_value <= 100,
    { message: "Percentage discounts cannot exceed 100" },
  );

export type CreateCouponBody = z.infer<
  typeof createCouponSchema.shape.body
>;

export const updateCouponSchema = z
  .object({
    params: z.object({
      coupon_public_id: publicIdParam,
    }),
    body: z
      .object({
        code: couponCodeField.optional(),
        discount_type: z.enum(["FIXED_AMOUNT", "PERCENTAGE"]).optional(),
        discount_value: z.coerce.number().positive().max(100).optional(),
        minimum_order_amount: z.coerce.number().min(0).nullish(),
        maximum_discount_amount: z.coerce.number().positive().nullish(),
        usage_limit: z.coerce.number().int().min(1).optional(),
        usage_limit_per_user: z.coerce.number().int().min(1).optional(),
        starts_at: z.coerce.date().nullish(),
        expires_at: z.coerce.date().nullish(),
        is_active: z.boolean().optional(),
      })
      .refine((body) => Object.keys(body).length > 0, {
        message: "At least one field must be provided",
      }),
  });

export type UpdateCouponBody = z.infer<
  typeof updateCouponSchema.shape.body
>;

export const couponParamsSchema = z.object({
  params: z.object({
    coupon_public_id: publicIdParam,
  }),
});

export type CouponParams = z.infer<
  typeof couponParamsSchema.shape.params
>;

export const couponUsagesQuerySchema = z.object({
  params: z.object({
    coupon_public_id: publicIdParam,
  }),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export type CouponUsagesQuery = z.infer<
  typeof couponUsagesQuerySchema.shape.query
>;
