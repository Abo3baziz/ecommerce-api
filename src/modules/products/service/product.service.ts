import { prisma } from "../../../config/database.js";
import { PUBLIC_ID_PREFIXES } from "../../../shared/constants/index.js";
import { BadRequestError } from "../../../shared/errors/BadRequestError.js";
import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import { formatPaginationMeta, generatePublicId } from "../../../shared/utils/index.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import {
  productRepository,
  type AdminDetailRow,
  type CustomerDetailRow,
  type ProductFilters,
  type ProductRow,
} from "../repository/product.repository.js";
import {
  computeFinalPrice,
  decimalToFixed,
} from "../utils/format.js";
import { slugify } from "../utils/slug.js";
import { parseSort } from "../utils/sort.js";
import type {
  AdminProductDetailResult,
  AdminVariantResult,
  CreateProductInput,
  CustomerProductDetailResult,
  CustomerVariantResult,
  ListProductsResult,
  ProductResult,
  UpdateProductInput,
} from "../dto/product.js";

function toProductResult(row: ProductRow): ProductResult {
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

function toCustomerVariantResult(
  row: CustomerDetailRow["product_variants"][number],
): CustomerVariantResult {
  return {
    public_id: row.public_id,
    sku: row.sku,
    color: row.color,
    size: row.size,
    price: row.price.toFixed(2),
    discount_percentage: decimalToFixed(row.discount_percentage),
    final_price: computeFinalPrice(row.price, row.discount_percentage),
    weight: decimalToFixed(row.weight),
    images: row.product_variant_images.map((image) => ({
      public_id: image.public_id,
      image_url: image.image_url,
      alt_text: image.alt_text,
      display_order: image.display_order,
    })),
  };
}

function toCustomerProductDetail(row: CustomerDetailRow): CustomerProductDetailResult {
  return {
    ...toProductResult(row),
    variants: row.product_variants.map(toCustomerVariantResult),
    images: row.product_images.map((image) => ({
      public_id: image.public_id,
      image_url: image.image_url,
      alt_text: image.alt_text,
      display_order: image.display_order,
      is_primary: image.is_primary,
    })),
  };
}

function toAdminVariantResult(
  row: AdminDetailRow["product_variants"][number],
  productPublicId: string,
): AdminVariantResult {
  return {
    public_id: row.public_id,
    product_public_id: productPublicId,
    sku: row.sku,
    barcode: row.barcode,
    color: row.color,
    size: row.size,
    price: row.price.toFixed(2),
    cost_price: decimalToFixed(row.cost_price),
    discount_percentage: decimalToFixed(row.discount_percentage),
    weight: decimalToFixed(row.weight),
    length: decimalToFixed(row.length),
    width: decimalToFixed(row.width),
    height: decimalToFixed(row.height),
    status: row.status,
    images: row.product_variant_images.map((image) => ({
      public_id: image.public_id,
      product_variant_public_id: row.public_id,
      image_url: image.image_url,
      alt_text: image.alt_text,
      display_order: image.display_order,
    })),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toAdminProductDetail(row: AdminDetailRow): AdminProductDetailResult {
  return {
    ...toProductResult(row),
    variants: row.product_variants.map((variant) =>
      toAdminVariantResult(variant, row.public_id),
    ),
    images: row.product_images.map((image) => ({
      public_id: image.public_id,
      product_public_id: row.public_id,
      image_url: image.image_url,
      alt_text: image.alt_text,
      display_order: image.display_order,
      is_primary: image.is_primary,
      created_at: image.created_at,
      updated_at: image.updated_at,
    })),
  };
}

async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name);

  if (!base) {
    throw new BadRequestError("Could not generate a slug from the product name");
  }

  let slug = base;
  let suffix = 2;

  while (await productRepository.findBySlug(slug)) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  return slug;
}

export async function listProducts(
  page: number,
  limit: number,
  search: string | undefined,
  brand: string | undefined,
  sort: string,
): Promise<ListProductsResult> {
  const { field, direction } = parseSort(sort);
  const orderBy = { [field]: direction } as Prisma.productsOrderByWithRelationInput;
  const filters: ProductFilters = { search, brand, customerVisible: true };

  const [rows, total] = await Promise.all([
    productRepository.listProducts(filters, orderBy, (page - 1) * limit, limit),
    productRepository.countProducts(filters),
  ]);

  return {
    products: rows.map(toProductResult),
    pagination: formatPaginationMeta(page, limit, total),
  };
}

export async function getProduct(
  productPublicId: string,
): Promise<CustomerProductDetailResult> {
  const row = await productRepository.findCustomerDetailByPublicId(productPublicId);

  if (!row) {
    throw new NotFoundError("Product not found");
  }

  return toCustomerProductDetail(row);
}

export async function listAdminProducts(
  page: number,
  limit: number,
  search: string | undefined,
  brand: string | undefined,
  includeDeleted: boolean,
  sort: string,
): Promise<ListProductsResult> {
  const { field, direction } = parseSort(sort);
  const orderBy = { [field]: direction } as Prisma.productsOrderByWithRelationInput;
  const filters: ProductFilters = { search, brand, include_deleted: includeDeleted };

  const [rows, total] = await Promise.all([
    productRepository.listProducts(filters, orderBy, (page - 1) * limit, limit),
    productRepository.countProducts(filters),
  ]);

  return {
    products: rows.map(toProductResult),
    pagination: formatPaginationMeta(page, limit, total),
  };
}

export async function createProduct(input: CreateProductInput): Promise<ProductResult> {
  let slug = input.slug;

  if (slug) {
    const existing = await productRepository.findBySlug(slug);
    if (existing) {
      throw new ConflictError("A product with this slug already exists");
    }
  } else {
    slug = await generateUniqueSlug(input.name);
  }

  const created = await productRepository.createProduct({
    public_id: generatePublicId(PUBLIC_ID_PREFIXES.PRODUCT),
    name: input.name,
    slug,
    description: input.description ?? null,
    brand: input.brand ?? null,
  });

  return toProductResult(created);
}

export async function getAdminProduct(
  productPublicId: string,
  includeDeletedVariants: boolean,
): Promise<AdminProductDetailResult> {
  const row = await productRepository.findAdminDetailByPublicId(
    productPublicId,
    includeDeletedVariants,
  );

  if (!row) {
    throw new NotFoundError("Product not found");
  }

  return toAdminProductDetail(row);
}

export async function updateProduct(
  productPublicId: string,
  input: UpdateProductInput,
): Promise<ProductResult> {
  const existing = await productRepository.findIdByPublicId(productPublicId);

  if (!existing) {
    throw new NotFoundError("Product not found");
  }

  if (input.slug) {
    const conflict = await productRepository.findBySlug(input.slug, existing.id);
    if (conflict) {
      throw new ConflictError("A product with this slug already exists");
    }
  }

  const updated = await productRepository.updateProduct(existing.id, {
    name: input.name,
    slug: input.slug,
    description: input.description,
    brand: input.brand,
  });

  return toProductResult(updated);
}

export async function deleteProduct(productPublicId: string): Promise<void> {
  const existing = await productRepository.findIdByPublicId(productPublicId);

  if (!existing) {
    throw new NotFoundError("Product not found");
  }

  await prisma.$transaction(async (tx) => {
    await productRepository.softDeleteVariantsByProductId(existing.id, tx);
    await productRepository.softDelete(existing.id, tx);
  });
}
