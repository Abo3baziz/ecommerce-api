import { prisma } from "../../src/config/database.js";
import { generatePublicId } from "../../src/shared/utils/index.js";
import { PUBLIC_ID_PREFIXES } from "../../src/shared/constants/index.js";
import { imageKitImageUrl } from "../helpers/image-url.js";

export interface CreateVariantImageOverrides {
  image_url?: string;
  alt_text?: string | null;
  display_order?: number;
}

export async function createVariantImage(
  productVariantsId: number,
  overrides: CreateVariantImageOverrides = {},
) {
  return prisma.product_variant_images.create({
    data: {
      public_id: generatePublicId(PUBLIC_ID_PREFIXES.VARIANT_IMAGE),
      product_variants_id: productVariantsId,
      image_url: overrides.image_url ?? imageKitImageUrl(),
      alt_text: overrides.alt_text ?? "Test variant image",
      display_order: overrides.display_order ?? 0,
    },
  });
}
