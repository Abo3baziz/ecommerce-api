import { prisma } from "../../../config/database.js";
import { PUBLIC_ID_PREFIXES } from "../../../shared/constants/index.js";
import { BadRequestError } from "../../../shared/errors/BadRequestError.js";
import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import { formatPaginationMeta, generatePublicId } from "../../../shared/utils/index.js";
import { Prisma } from "../../../generated/prisma/client.js";
import {
  categoryRepository,
  type CategoryFilters,
  type CategoryProductFilters,
  type CategoryProductRow,
  type CategoryRow,
} from "../repository/category.repository.js";
import { slugify } from "../utils/slug.js";
import { parseSort } from "../utils/sort.js";
import type {
  AdminCategoryDetailResult,
  AdminCategoryResult,
  CategoryResult,
  CreateCategoryInput,
  CustomerCategoryDetailResult,
  ListAdminCategoriesResult,
  ListCategoriesResult,
  ListCategoryProductsResult,
  UpdateCategoryInput,
} from "../dto/category.js";
import type { ProductResult } from "../dto/category.js";

function toCategoryResult(row: CategoryRow): CategoryResult {
  return {
    public_id: row.public_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toAdminCategoryResult(row: CategoryRow): AdminCategoryResult {
  return {
    ...toCategoryResult(row),
    is_active: row.is_active,
  };
}

function toCategoryProductResult(row: CategoryProductRow): ProductResult {
  return {
    public_id: row.public_id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    brand: row.brand,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name);

  if (!base) {
    throw new BadRequestError("Could not generate a slug from the category name");
  }

  let slug = base;
  let suffix = 2;

  while (await categoryRepository.findBySlug(slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

export async function listCategories(
  page: number,
  limit: number,
  search: string | undefined,
  sort: string,
): Promise<ListCategoriesResult> {
  const { field, direction } = parseSort(sort);
  const orderBy: Prisma.categoriesOrderByWithRelationInput[] = [
    { [field]: direction },
    { id: direction },
  ];
  const filters: CategoryFilters = { search, customerVisible: true };

  const [rows, total] = await Promise.all([
    categoryRepository.listCategories(filters, orderBy, (page - 1) * limit, limit),
    categoryRepository.countCategories(filters),
  ]);

  return {
    categories: rows.map(toCategoryResult),
    pagination: formatPaginationMeta(page, limit, total),
  };
}

export async function getCategory(
  categoryPublicId: string,
): Promise<CustomerCategoryDetailResult> {
  const row = await categoryRepository.findCustomerDetailByPublicId(categoryPublicId);

  if (!row) {
    throw new NotFoundError("Category not found");
  }

  const productCount = await categoryRepository.countCustomerProducts(row.id);

  return {
    ...toCategoryResult(row),
    product_count: productCount,
  };
}

export async function listCategoryProducts(
  categoryPublicId: string,
  page: number,
  limit: number,
  search: string | undefined,
  sort: string,
): Promise<ListCategoryProductsResult> {
  const category = await categoryRepository.findCustomerDetailByPublicId(
    categoryPublicId,
  );

  if (!category) {
    throw new NotFoundError("Category not found");
  }

  const { field, direction } = parseSort(sort);
  const orderBy: Prisma.productsOrderByWithRelationInput[] = [
    { [field]: direction },
    { id: direction },
  ];
  const filters: CategoryProductFilters = { search, customerVisible: true };

  const [rows, total] = await Promise.all([
    categoryRepository.listCategoryProducts(
      category.id,
      filters,
      orderBy,
      (page - 1) * limit,
      limit,
    ),
    categoryRepository.countCategoryProducts(category.id, filters),
  ]);

  return {
    products: rows.map(toCategoryProductResult),
    pagination: formatPaginationMeta(page, limit, total),
  };
}

export async function listAdminCategories(
  page: number,
  limit: number,
  search: string | undefined,
  isActive: boolean | undefined,
  includeDeleted: boolean,
  sort: string,
): Promise<ListAdminCategoriesResult> {
  const { field, direction } = parseSort(sort);
  const orderBy: Prisma.categoriesOrderByWithRelationInput[] = [
    { [field]: direction },
    { id: direction },
  ];
  const filters: CategoryFilters = {
    search,
    is_active: isActive,
    include_deleted: includeDeleted,
  };

  const [rows, total] = await Promise.all([
    categoryRepository.listCategories(filters, orderBy, (page - 1) * limit, limit),
    categoryRepository.countCategories(filters),
  ]);

  return {
    categories: rows.map(toAdminCategoryResult),
    pagination: formatPaginationMeta(page, limit, total),
  };
}

export async function createCategory(
  input: CreateCategoryInput,
): Promise<AdminCategoryResult> {
  let slug = input.slug;

  if (slug) {
    const existing = await categoryRepository.findBySlug(slug);
    if (existing) {
      throw new ConflictError("A category with this slug already exists");
    }
  } else {
    slug = await generateUniqueSlug(input.name);
  }

  const nameConflict = await categoryRepository.findByName(input.name);
  if (nameConflict) {
    throw new ConflictError("A category with this name already exists");
  }

  const created = await categoryRepository.createCategory({
    public_id: generatePublicId(PUBLIC_ID_PREFIXES.CATEGORY),
    name: input.name,
    slug,
    description: input.description ?? null,
    is_active: input.is_active ?? true,
  });

  return toAdminCategoryResult(created);
}

export async function getAdminCategory(
  categoryPublicId: string,
): Promise<AdminCategoryDetailResult> {
  const row = await categoryRepository.findAdminDetailByPublicId(categoryPublicId);

  if (!row) {
    throw new NotFoundError("Category not found");
  }

  const productCount = await categoryRepository.countAdminProducts(row.id);

  return {
    ...toAdminCategoryResult(row),
    product_count: productCount,
  };
}

export async function updateCategory(
  categoryPublicId: string,
  input: UpdateCategoryInput,
): Promise<AdminCategoryResult> {
  const existing = await categoryRepository.findIdByPublicId(categoryPublicId);

  if (!existing) {
    throw new NotFoundError("Category not found");
  }

  if (input.slug) {
    const slugConflict = await categoryRepository.findBySlug(input.slug, existing.id);
    if (slugConflict) {
      throw new ConflictError("A category with this slug already exists");
    }
  }

  if (input.name) {
    const nameConflict = await categoryRepository.findByName(input.name, existing.id);
    if (nameConflict) {
      throw new ConflictError("A category with this name already exists");
    }
  }

  const updated = await categoryRepository.updateCategory(existing.id, {
    name: input.name,
    slug: input.slug,
    description: input.description,
    is_active: input.is_active,
  });

  return toAdminCategoryResult(updated);
}

export async function deleteCategory(categoryPublicId: string): Promise<void> {
  const existing = await categoryRepository.findIdByPublicId(categoryPublicId);

  if (!existing) {
    throw new NotFoundError("Category not found");
  }

  await prisma.$transaction(async (tx) => {
    await categoryRepository.softDelete(existing.id, tx);
    await categoryRepository.deleteCategoryLinks(existing.id, tx);
  });
}

export async function assignProductToCategory(
  categoryPublicId: string,
  productPublicId: string,
): Promise<void> {
  const category = await categoryRepository.findIdByPublicId(categoryPublicId);

  if (!category) {
    throw new NotFoundError("Category not found");
  }

  const product = await categoryRepository.findProductIdByPublicId(productPublicId);

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  const existing = await categoryRepository.findCategoryLink(category.id, product.id);

  if (existing) {
    return;
  }

  try {
    await categoryRepository.createCategoryLink(category.id, product.id);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return;
    }
    throw error;
  }
}

export async function unassignProductFromCategory(
  categoryPublicId: string,
  productPublicId: string,
): Promise<void> {
  const category = await categoryRepository.findIdByPublicId(categoryPublicId);

  if (!category) {
    throw new NotFoundError("Category not found");
  }

  const product = await categoryRepository.findProductIdByPublicId(productPublicId);

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  await categoryRepository.deleteCategoryLink(category.id, product.id);
}
