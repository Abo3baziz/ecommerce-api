import { nanoid } from "nanoid";
import { prisma } from "../../src/config/database.js";
import { generatePublicId } from "../../src/shared/utils/index.js";
import { PUBLIC_ID_PREFIXES } from "../../src/shared/constants/index.js";

export interface CreateProductOverrides {
  name?: string;
  slug?: string;
  description?: string | null;
  brand?: string | null;
  deleted_at?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

export async function createProduct(overrides: CreateProductOverrides = {}) {
  const now = new Date();

  return prisma.products.create({
    data: {
      public_id: generatePublicId(PUBLIC_ID_PREFIXES.PRODUCT),
      name: overrides.name ?? `Test Product ${nanoid(6)}`,
      slug: overrides.slug ?? `test-product-${nanoid(6)}`,
      description: overrides.description ?? "A test product description.",
      brand: overrides.brand ?? "TestBrand",
      deleted_at: overrides.deleted_at ?? null,
      created_at: overrides.created_at ?? now,
      updated_at: overrides.updated_at ?? now,
    },
  });
}
