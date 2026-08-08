import { prisma } from "../../../config/database.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import type { product_status } from "../../../generated/prisma/enums.js";

type DbClient = Prisma.TransactionClient | typeof prisma;

export interface VariantFilters {
  status?: product_status;
  include_deleted?: boolean;
}

export interface CreateVariantData {
  public_id: string;
  products_id: number;
  sku: string;
  barcode: string | null;
  color: string | null;
  size: string | null;
  price: string;
  cost_price: string | null;
  discount_percentage: string;
  weight: string | null;
  length: string | null;
  width: string | null;
  height: string | null;
  status: product_status;
}

export interface UpdateVariantData {
  sku?: string;
  barcode?: string | null;
  color?: string | null;
  size?: string | null;
  price?: string;
  cost_price?: string | null;
  discount_percentage?: string;
  weight?: string | null;
  length?: string | null;
  width?: string | null;
  height?: string | null;
  status?: product_status | null;
}

const variantSelect = {
  id: true,
  public_id: true,
  sku: true,
  barcode: true,
  color: true,
  size: true,
  price: true,
  cost_price: true,
  discount_percentage: true,
  weight: true,
  length: true,
  width: true,
  height: true,
  status: true,
  created_at: true,
  updated_at: true,
} as const;

export type VariantRow = Prisma.product_variantsGetPayload<{
  select: typeof variantSelect;
}>;

const variantDetailSelect = {
  ...variantSelect,
  product_variant_images: {
    orderBy: { display_order: "asc" as const },
    select: {
      public_id: true,
      image_url: true,
      alt_text: true,
      display_order: true,
    },
  },
} as const;

export type VariantDetailRow = Prisma.product_variantsGetPayload<{
  select: typeof variantDetailSelect;
}>;

function buildWhere(
  products_id: number,
  filters: VariantFilters,
): Prisma.product_variantsWhereInput {
  return {
    products_id,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.include_deleted ? {} : { deleted_at: null }),
  };
}

export const variantRepository = {
  createVariant(data: CreateVariantData, client: DbClient = prisma) {
    const now = new Date();
    return client.product_variants.create({
      data: {
        ...data,
        created_at: now,
        updated_at: now,
      },
      select: variantSelect,
    });
  },

  findByPublicIdAndProduct(
    public_id: string,
    products_id: number,
    include_deleted = false,
  ) {
    return prisma.product_variants.findFirst({
      where: {
        public_id,
        products_id,
        ...(include_deleted ? {} : { deleted_at: null }),
      },
      select: variantSelect,
    });
  },

  findIdByPublicIdAndProduct(
    public_id: string,
    products_id: number,
    include_deleted = false,
  ) {
    return prisma.product_variants.findFirst({
      where: {
        public_id,
        products_id,
        ...(include_deleted ? {} : { deleted_at: null }),
      },
      select: { id: true },
    });
  },

  findBySku(sku: string, excludeId?: number) {
    return prisma.product_variants.findFirst({
      where: {
        sku,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
  },

  countVariants(products_id: number, filters: VariantFilters) {
    return prisma.product_variants.count({
      where: buildWhere(products_id, filters),
    });
  },

  listVariants(
    products_id: number,
    filters: VariantFilters,
    orderBy: Prisma.product_variantsOrderByWithRelationInput,
    skip: number,
    take: number,
  ) {
    return prisma.product_variants.findMany({
      where: buildWhere(products_id, filters),
      orderBy,
      skip,
      take,
      select: variantSelect,
    });
  },

  findWithImagesByPublicId(public_id: string, products_id: number) {
    return prisma.product_variants.findFirst({
      where: {
        public_id,
        products_id,
        deleted_at: null,
      },
      select: variantDetailSelect,
    });
  },

  updateVariant(id: number, data: UpdateVariantData, client: DbClient = prisma) {
    return client.product_variants.update({
      where: { id },
      data: {
        ...data,
        updated_at: new Date(),
      },
      select: variantSelect,
    });
  },

  softDelete(id: number, client: DbClient = prisma) {
    return client.product_variants.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        updated_at: new Date(),
      },
    });
  },
};
