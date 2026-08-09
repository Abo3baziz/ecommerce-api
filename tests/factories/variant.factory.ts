import { nanoid } from "nanoid";
import { prisma } from "../../src/config/database.js";
import { generatePublicId } from "../../src/shared/utils/index.js";
import { PUBLIC_ID_PREFIXES } from "../../src/shared/constants/index.js";
import { product_status } from "../../src/generated/prisma/enums.js";

export interface CreateVariantOverrides {
  sku?: string;
  barcode?: string | null;
  color?: string | null;
  size?: string | null;
  price?: string;
  cost_price?: string | null;
  discount_percentage?: string | null;
  weight?: string | null;
  length?: string | null;
  width?: string | null;
  height?: string | null;
  status?: product_status | null;
  deleted_at?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

export async function createVariant(
  productsId: number,
  overrides: CreateVariantOverrides = {},
) {
  const now = new Date();

  return prisma.product_variants.create({
    data: {
      public_id: generatePublicId(PUBLIC_ID_PREFIXES.VARIANT),
      products_id: productsId,
      sku: overrides.sku ?? `TEST-SKU-${nanoid(8)}`,
      barcode: overrides.barcode ?? null,
      color: overrides.color ?? "Black",
      size: overrides.size ?? "M",
      price: overrides.price ?? "129.99",
      cost_price: overrides.cost_price ?? "85.00",
      discount_percentage: overrides.discount_percentage ?? "0.00",
      weight: overrides.weight ?? null,
      length: overrides.length ?? null,
      width: overrides.width ?? null,
      height: overrides.height ?? null,
      status: overrides.status ?? product_status.ACTIVE,
      deleted_at: overrides.deleted_at ?? null,
      created_at: overrides.created_at ?? now,
      updated_at: overrides.updated_at ?? now,
    },
  });
}
