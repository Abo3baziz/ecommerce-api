import { prisma } from "../../../config/database.js";
import type { Prisma } from "../../../generated/prisma/client.js";

type DbClient = Prisma.TransactionClient | typeof prisma;

export interface CreateVariantImageData {
  public_id: string;
  product_variants_id: number;
  image_url: string;
  alt_text: string | null;
  display_order: number;
}

export interface UpdateVariantImageData {
  image_url?: string;
  alt_text?: string | null;
  display_order?: number;
}

const variantImageSelect = {
  id: true,
  public_id: true,
  image_url: true,
  alt_text: true,
  display_order: true,
} as const;

export type VariantImageRow = Prisma.product_variant_imagesGetPayload<{
  select: typeof variantImageSelect;
}>;

export const variantImageRepository = {
  createImage(data: CreateVariantImageData, client: DbClient = prisma) {
    return client.product_variant_images.create({
      data,
      select: variantImageSelect,
    });
  },

  findByPublicIdAndVariant(public_id: string, product_variants_id: number) {
    return prisma.product_variant_images.findFirst({
      where: { public_id, product_variants_id },
      select: variantImageSelect,
    });
  },

  findIdByPublicIdAndVariant(public_id: string, product_variants_id: number) {
    return prisma.product_variant_images.findFirst({
      where: { public_id, product_variants_id },
      select: { id: true },
    });
  },

  countByVariant(product_variants_id: number) {
    return prisma.product_variant_images.count({
      where: { product_variants_id },
    });
  },

  listByVariant(product_variants_id: number, skip: number, take: number) {
    return prisma.product_variant_images.findMany({
      where: { product_variants_id },
      orderBy: { display_order: "asc" },
      skip,
      take,
      select: variantImageSelect,
    });
  },

  findMaxDisplayOrder(product_variants_id: number) {
    return prisma.product_variant_images.findFirst({
      where: { product_variants_id },
      orderBy: { display_order: "desc" },
      select: { display_order: true },
    });
  },

  findByDisplayOrder(product_variants_id: number, display_order: number) {
    return prisma.product_variant_images.findFirst({
      where: { product_variants_id, display_order },
      select: { id: true },
    });
  },

  updateImage(id: number, data: UpdateVariantImageData, client: DbClient = prisma) {
    return client.product_variant_images.update({
      where: { id },
      data,
      select: variantImageSelect,
    });
  },

  deleteImage(id: number, client: DbClient = prisma) {
    return client.product_variant_images.delete({
      where: { id },
    });
  },
};
