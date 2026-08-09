import { prisma } from "../../../config/database.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { product_status } from "../../../generated/prisma/enums.js";

type DbClient = Prisma.TransactionClient | typeof prisma;

export interface ProductFilters {
  search?: string;
  brand?: string;
  include_deleted?: boolean;
  customerVisible?: boolean;
}

export interface CreateProductData {
  public_id: string;
  name: string;
  slug: string;
  description: string | null;
  brand: string | null;
}

export interface UpdateProductData {
  name?: string;
  slug?: string;
  description?: string | null;
  brand?: string | null;
}

const productSelect = {
  id: true,
  public_id: true,
  slug: true,
  name: true,
  description: true,
  brand: true,
  created_at: true,
  updated_at: true,
} as const;

export type ProductRow = Prisma.productsGetPayload<{
  select: typeof productSelect;
}>;

const customerDetailSelect = {
  ...productSelect,
  product_images: {
    orderBy: { display_order: "asc" as const },
    select: {
      public_id: true,
      image_url: true,
      alt_text: true,
      display_order: true,
      is_primary: true,
    },
  },
  product_variants: {
    where: { deleted_at: null, status: product_status.ACTIVE },
    orderBy: { created_at: "asc" as const },
    select: {
      public_id: true,
      sku: true,
      color: true,
      size: true,
      price: true,
      discount_percentage: true,
      weight: true,
      product_variant_images: {
        orderBy: { display_order: "asc" as const },
        select: {
          public_id: true,
          image_url: true,
          alt_text: true,
          display_order: true,
        },
      },
    },
  },
} as const;

export type CustomerDetailRow = Prisma.productsGetPayload<{
  select: typeof customerDetailSelect;
}>;

const adminDetailSelect = {
  ...productSelect,
  product_images: {
    orderBy: { display_order: "asc" as const },
    select: {
      public_id: true,
      image_url: true,
      alt_text: true,
      display_order: true,
      is_primary: true,
      created_at: true,
      updated_at: true,
    },
  },
  product_variants: {
    orderBy: { created_at: "asc" as const },
    select: {
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
      product_variant_images: {
        orderBy: { display_order: "asc" as const },
        select: {
          public_id: true,
          image_url: true,
          alt_text: true,
          display_order: true,
        },
      },
    },
  },
} as const;

export type AdminDetailRow = Prisma.productsGetPayload<{
  select: typeof adminDetailSelect;
}>;

function buildWhere(filters: ProductFilters): Prisma.productsWhereInput {
  const where: Prisma.productsWhereInput = {};

  if (!filters.include_deleted) {
    where.deleted_at = null;
  }

  if (filters.customerVisible) {
    where.product_variants = {
      some: {
        deleted_at: null,
        status: product_status.ACTIVE,
      },
    };
  }

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { brand: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  if (filters.brand) {
    where.brand = { equals: filters.brand, mode: "insensitive" };
  }

  return where;
}

export const productRepository = {
  createProduct(data: CreateProductData, client: DbClient = prisma) {
    const now = new Date();
    return client.products.create({
      data: {
        ...data,
        created_at: now,
        updated_at: now,
      },
      select: productSelect,
    });
  },

  findByPublicId(public_id: string, include_deleted = false) {
    return prisma.products.findFirst({
      where: {
        public_id,
        ...(include_deleted ? {} : { deleted_at: null }),
      },
      select: productSelect,
    });
  },

  findIdByPublicId(public_id: string, include_deleted = false) {
    return prisma.products.findFirst({
      where: {
        public_id,
        ...(include_deleted ? {} : { deleted_at: null }),
      },
      select: { id: true },
    });
  },

  findBySlug(slug: string, excludeId?: number) {
    return prisma.products.findFirst({
      where: {
        slug,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
  },

  countProducts(filters: ProductFilters) {
    return prisma.products.count({
      where: buildWhere(filters),
    });
  },

  listProducts(
    filters: ProductFilters,
    orderBy: Prisma.productsOrderByWithRelationInput,
    skip: number,
    take: number,
  ) {
    return prisma.products.findMany({
      where: buildWhere(filters),
      orderBy,
      skip,
      take,
      select: productSelect,
    });
  },

  updateProduct(id: number, data: UpdateProductData, client: DbClient = prisma) {
    return client.products.update({
      where: { id },
      data: {
        ...data,
        updated_at: new Date(),
      },
      select: productSelect,
    });
  },

  softDelete(id: number, client: DbClient = prisma) {
    return client.products.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        updated_at: new Date(),
      },
    });
  },

  softDeleteVariantsByProductId(products_id: number, client: DbClient = prisma) {
    return client.product_variants.updateMany({
      where: {
        products_id,
        deleted_at: null,
      },
      data: {
        deleted_at: new Date(),
        updated_at: new Date(),
      },
    });
  },

  findCustomerDetailByPublicId(public_id: string) {
    return prisma.products.findFirst({
      where: {
        public_id,
        deleted_at: null,
        product_variants: {
          some: {
            deleted_at: null,
            status: product_status.ACTIVE,
          },
        },
      },
      select: customerDetailSelect,
    });
  },

  findAdminDetailByPublicId(public_id: string, include_deleted_variants: boolean) {
    return prisma.products.findFirst({
      where: {
        public_id,
        deleted_at: null,
      },
      select: {
        ...adminDetailSelect,
        product_variants: {
          where: include_deleted_variants ? {} : { deleted_at: null },
          orderBy: { created_at: "asc" as const },
          select: adminDetailSelect.product_variants.select,
        },
      },
    });
  },
};
