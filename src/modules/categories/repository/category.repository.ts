import { prisma } from "../../../config/database.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { product_status } from "../../../generated/prisma/enums.js";

type DbClient = Prisma.TransactionClient | typeof prisma;

export interface CategoryFilters {
  search?: string;
  is_active?: boolean;
  include_deleted?: boolean;
  customerVisible?: boolean;
}

export interface CategoryProductFilters {
  search?: string;
  customerVisible: boolean;
}

export interface CreateCategoryData {
  public_id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
}

export interface UpdateCategoryData {
  name?: string;
  slug?: string;
  description?: string | null;
  is_active?: boolean;
}

const categorySelect = {
  id: true,
  public_id: true,
  name: true,
  slug: true,
  description: true,
  is_active: true,
  created_at: true,
  updated_at: true,
} as const;

export type CategoryRow = Prisma.categoriesGetPayload<{
  select: typeof categorySelect;
}>;

const categoryProductSelect = {
  id: true,
  public_id: true,
  slug: true,
  name: true,
  description: true,
  brand: true,
  created_at: true,
  updated_at: true,
} as const;

export type CategoryProductRow = Prisma.productsGetPayload<{
  select: typeof categoryProductSelect;
}>;

function buildWhere(filters: CategoryFilters): Prisma.categoriesWhereInput {
  const where: Prisma.categoriesWhereInput = {};

  if (filters.customerVisible) {
    where.is_active = true;
    where.deleted_at = null;
  }

  if (!filters.include_deleted) {
    where.deleted_at = null;
  }

  if (filters.is_active !== undefined) {
    where.is_active = filters.is_active;
  }

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { slug: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

function buildProductWhere(
  categoriesId: number,
  filters: CategoryProductFilters,
): Prisma.productsWhereInput {
  const where: Prisma.productsWhereInput = {
    product_categories: {
      some: {
        categories_id: categoriesId,
      },
    },
  };

  if (filters.customerVisible) {
    where.deleted_at = null;
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

  return where;
}

export const categoryRepository = {
  createCategory(data: CreateCategoryData, client: DbClient = prisma) {
    const now = new Date();
    return client.categories.create({
      data: {
        ...data,
        created_at: now,
        updated_at: now,
      },
      select: categorySelect,
    });
  },

  findIdByPublicId(public_id: string, include_deleted = false) {
    return prisma.categories.findFirst({
      where: {
        public_id,
        ...(include_deleted ? {} : { deleted_at: null }),
      },
      select: { id: true },
    });
  },

  findByName(name: string, excludeId?: number) {
    return prisma.categories.findFirst({
      where: {
        name,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
  },

  findBySlug(slug: string, excludeId?: number) {
    return prisma.categories.findFirst({
      where: {
        slug,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
  },

  findProductIdByPublicId(public_id: string) {
    return prisma.products.findFirst({
      where: {
        public_id,
        deleted_at: null,
      },
      select: { id: true },
    });
  },

  countCategories(filters: CategoryFilters) {
    return prisma.categories.count({
      where: buildWhere(filters),
    });
  },

  listCategories(
    filters: CategoryFilters,
    orderBy: Prisma.categoriesOrderByWithRelationInput,
    skip: number,
    take: number,
  ) {
    return prisma.categories.findMany({
      where: buildWhere(filters),
      orderBy,
      skip,
      take,
      select: categorySelect,
    });
  },

  findCustomerDetailByPublicId(public_id: string) {
    return prisma.categories.findFirst({
      where: {
        public_id,
        is_active: true,
        deleted_at: null,
      },
      select: categorySelect,
    });
  },

  findAdminDetailByPublicId(public_id: string) {
    return prisma.categories.findFirst({
      where: {
        public_id,
        deleted_at: null,
      },
      select: categorySelect,
    });
  },

  countCustomerProducts(categories_id: number) {
    return prisma.product_categories.count({
      where: {
        categories_id,
        products: {
          deleted_at: null,
          product_variants: {
            some: {
              deleted_at: null,
              status: product_status.ACTIVE,
            },
          },
        },
      },
    });
  },

  countAdminProducts(categories_id: number) {
    return prisma.product_categories.count({
      where: {
        categories_id,
        products: {
          deleted_at: null,
        },
      },
    });
  },

  updateCategory(id: number, data: UpdateCategoryData, client: DbClient = prisma) {
    return client.categories.update({
      where: { id },
      data: {
        ...data,
        updated_at: new Date(),
      },
      select: categorySelect,
    });
  },

  softDelete(id: number, client: DbClient = prisma) {
    return client.categories.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        updated_at: new Date(),
      },
    });
  },

  deleteCategoryLinks(categories_id: number, client: DbClient = prisma) {
    return client.product_categories.deleteMany({
      where: { categories_id },
    });
  },

  findCategoryLink(categories_id: number, products_id: number) {
    return prisma.product_categories.findFirst({
      where: {
        categories_id,
        products_id,
      },
      select: { id: true },
    });
  },

  createCategoryLink(
    categories_id: number,
    products_id: number,
    client: DbClient = prisma,
  ) {
    return client.product_categories.create({
      data: {
        categories_id,
        products_id,
        created_at: new Date(),
      },
    });
  },

  deleteCategoryLink(
    categories_id: number,
    products_id: number,
    client: DbClient = prisma,
  ) {
    return client.product_categories.deleteMany({
      where: {
        categories_id,
        products_id,
      },
    });
  },

  listCategoryProducts(
    categories_id: number,
    filters: CategoryProductFilters,
    orderBy: Prisma.productsOrderByWithRelationInput,
    skip: number,
    take: number,
  ) {
    return prisma.products.findMany({
      where: buildProductWhere(categories_id, filters),
      orderBy,
      skip,
      take,
      select: categoryProductSelect,
    });
  },

  countCategoryProducts(categories_id: number, filters: CategoryProductFilters) {
    return prisma.products.count({
      where: buildProductWhere(categories_id, filters),
    });
  },
};
