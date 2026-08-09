import { nanoid } from "nanoid";
import { prisma } from "../../src/config/database.js";
import { generatePublicId } from "../../src/shared/utils/index.js";
import { PUBLIC_ID_PREFIXES } from "../../src/shared/constants/index.js";

export interface CreateProductImageOverrides {
  image_url?: string;
  alt_text?: string | null;
  display_order?: number;
  is_primary?: boolean;
  created_at?: Date;
  updated_at?: Date;
}

export async function createProductImage(
  productsId: number,
  overrides: CreateProductImageOverrides = {},
) {
  const now = new Date();

  return prisma.product_images.create({
    data: {
      public_id: generatePublicId(PUBLIC_ID_PREFIXES.PRODUCT_IMAGE),
      products_id: productsId,
      image_url: overrides.image_url ?? `https://cdn.test.example/${nanoid(6)}.jpg`,
      alt_text: overrides.alt_text ?? "Test product image",
      display_order: overrides.display_order ?? 0,
      is_primary: overrides.is_primary ?? false,
      created_at: overrides.created_at ?? now,
      updated_at: overrides.updated_at ?? now,
    },
  });
}
