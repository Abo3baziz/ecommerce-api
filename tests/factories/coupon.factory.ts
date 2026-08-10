import { nanoid } from "nanoid";
import { prisma } from "../../src/config/database.js";
import { discount_type } from "../../src/generated/prisma/enums.js";

export interface CreateCouponOverrides {
  code?: string;
  discount_type?: discount_type;
  discount_value?: string;
  minimum_order_amount?: string | null;
  maximum_discount_amount?: string | null;
  usage_limit?: number;
  usage_limit_per_user?: number;
  usage_count?: number;
  starts_at?: Date | null;
  expires_at?: Date | null;
  is_active?: boolean;
  deleted_at?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

export async function createCoupon(overrides: CreateCouponOverrides = {}) {
  const now = new Date();

  return prisma.coupons.create({
    data: {
      public_id: `coup_${nanoid(12)}`,
      code: overrides.code ?? `TEST-COUPON-${nanoid(8)}`,
      discount_type: overrides.discount_type ?? discount_type.PERCENTAGE,
      discount_value: overrides.discount_value ?? "10.00",
      minimum_order_amount: overrides.minimum_order_amount ?? null,
      maximum_discount_amount: overrides.maximum_discount_amount ?? null,
      usage_limit: overrides.usage_limit ?? 100,
      usage_limit_per_user: overrides.usage_limit_per_user ?? 1,
      usage_count: overrides.usage_count ?? 0,
      starts_at: overrides.starts_at ?? null,
      expires_at: overrides.expires_at ?? null,
      is_active: overrides.is_active ?? true,
      deleted_at: overrides.deleted_at ?? null,
      created_at: overrides.created_at ?? now,
      updated_at: overrides.updated_at ?? now,
    },
  });
}
