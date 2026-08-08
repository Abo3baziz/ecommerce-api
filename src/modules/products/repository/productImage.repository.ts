import { prisma } from "../../../config/database.js";
import type { Prisma } from "../../../generated/prisma/client.js";

type DbClient = Prisma.TransactionClient | typeof prisma;

export interface CreateProductImageData {
  public_id: string;
  products_id: number;
  image_url: string;
  alt_text: string | null;
  display_order: number;
  is_primary: boolean;
}

export interface UpdateProductImageData {
  image_url?: string;
  alt_text?: string | null;
  display_order?: number;
  is_primary?: boolean;
}

const productImageSelect = {
  id: true,
  public_id: true,
  image_url: true,
  alt_text: true,
  display_order: true,
  is_primary: true,
  created_at: true,
  updated_at: true,
} as const;

export type ProductImageRow = Prisma.product_imagesGetPayload<{
  select: typeof productImageSelect;
}>;

export const productImageRepository = {
  createImage(data: CreateProductImageData, client: DbClient = prisma) {
    const now = new Date();
    return client.product_images.create({
      data: {
        ...data,
        created_at: now,
        updated_at: now,
      },
      select: productImageSelect,
    });
  },

  findByPublicIdAndProduct(public_id: string, products_id: number) {
    return prisma.product_images.findFirst({
      where: { public_id, products_id },
      select: productImageSelect,
    });
  },

  findIdByPublicIdAndProduct(public_id: string, products_id: number) {
    return prisma.product_images.findFirst({
      where: { public_id, products_id },
      select: { id: true, is_primary: true },
    });
  },

  countByProduct(products_id: number) {
    return prisma.product_images.count({
      where: { products_id },
    });
  },

  listByProduct(products_id: number, skip: number, take: number) {
    return prisma.product_images.findMany({
      where: { products_id },
      orderBy: { display_order: "asc" },
      skip,
      take,
      select: productImageSelect,
    });
  },

  findMaxDisplayOrder(products_id: number) {
    return prisma.product_images.findFirst({
      where: { products_id },
      orderBy: { display_order: "desc" },
      select: { display_order: true },
    });
  },

  findByDisplayOrder(products_id: number, display_order: number) {
    return prisma.product_images.findFirst({
      where: { products_id, display_order },
      select: { id: true },
    });
  },

  clearPrimary(products_id: number, exceptId: number | null, client: DbClient = prisma) {
    return client.product_images.updateMany({
      where: {
        products_id,
        is_primary: true,
        ...(exceptId === null ? {} : { id: { not: exceptId } }),
      },
      data: {
        is_primary: false,
        updated_at: new Date(),
      },
    });
  },

  findLowestOrderImage(products_id: number, excludeId: number, client: DbClient = prisma) {
    return client.product_images.findFirst({
      where: {
        products_id,
        id: { not: excludeId },
      },
      orderBy: { display_order: "asc" },
      select: { id: true },
    });
  },

  setPrimary(id: number, client: DbClient = prisma) {
    return client.product_images.update({
      where: { id },
      data: {
        is_primary: true,
        updated_at: new Date(),
      },
    });
  },

  updateImage(id: number, data: UpdateProductImageData, client: DbClient = prisma) {
    return client.product_images.update({
      where: { id },
      data: {
        ...data,
        updated_at: new Date(),
      },
      select: productImageSelect,
    });
  },

  deleteImage(id: number, client: DbClient = prisma) {
    return client.product_images.delete({
      where: { id },
    });
  },
};
