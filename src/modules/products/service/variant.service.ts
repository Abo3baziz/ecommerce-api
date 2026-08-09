import { PUBLIC_ID_PREFIXES } from "../../../shared/constants/index.js";
import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import { formatPaginationMeta, generatePublicId } from "../../../shared/utils/index.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { product_status } from "../../../generated/prisma/enums.js";
import { productRepository } from "../repository/product.repository.js";
import {
  variantRepository,
  type VariantDetailRow,
  type VariantRow,
} from "../repository/variant.repository.js";
import { decimalToFixed } from "../utils/format.js";
import { parseSort } from "../utils/sort.js";
import type {
  CreateVariantInput,
  ListVariantsResult,
  UpdateVariantInput,
  VariantDetailResult,
  VariantResult,
} from "../dto/variant.js";

function toVariantResult(row: VariantRow, productPublicId: string): VariantResult {
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
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toVariantDetailResult(
  row: VariantDetailRow,
  productPublicId: string,
): VariantDetailResult {
  return {
    ...toVariantResult(row, productPublicId),
    images: row.product_variant_images.map((image) => ({
      public_id: image.public_id,
      product_variant_public_id: row.public_id,
      image_url: image.image_url,
      alt_text: image.alt_text,
      display_order: image.display_order,
    })),
  };
}

async function requireProduct(productPublicId: string): Promise<{ id: number }> {
  const product = await productRepository.findIdByPublicId(productPublicId);

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  return product;
}

export async function listVariants(
  productPublicId: string,
  page: number,
  limit: number,
  status: product_status | undefined,
  includeDeleted: boolean,
  sort: string,
): Promise<ListVariantsResult> {
  const product = await requireProduct(productPublicId);
  const { field, direction } = parseSort(sort);
  const orderBy = { [field]: direction } as Prisma.product_variantsOrderByWithRelationInput;
  const filters = { status, include_deleted: includeDeleted };

  const [rows, total] = await Promise.all([
    variantRepository.listVariants(product.id, filters, orderBy, (page - 1) * limit, limit),
    variantRepository.countVariants(product.id, filters),
  ]);

  return {
    variants: rows.map((row) => toVariantResult(row, productPublicId)),
    pagination: formatPaginationMeta(page, limit, total),
  };
}

export async function createVariant(
  productPublicId: string,
  input: CreateVariantInput,
): Promise<VariantResult> {
  const product = await requireProduct(productPublicId);

  const existingSku = await variantRepository.findBySku(input.sku);
  if (existingSku) {
    throw new ConflictError("A variant with this SKU already exists");
  }

  const created = await variantRepository.createVariant({
    public_id: generatePublicId(PUBLIC_ID_PREFIXES.VARIANT),
    products_id: product.id,
    sku: input.sku,
    barcode: input.barcode ?? null,
    color: input.color ?? null,
    size: input.size ?? null,
    price: input.price,
    cost_price: input.cost_price ?? null,
    discount_percentage: input.discount_percentage ?? "0.00",
    weight: input.weight ?? null,
    length: input.length ?? null,
    width: input.width ?? null,
    height: input.height ?? null,
    status: input.status ?? product_status.ACTIVE,
  });

  return toVariantResult(created, productPublicId);
}

export async function getVariant(
  productPublicId: string,
  variantPublicId: string,
): Promise<VariantDetailResult> {
  const product = await requireProduct(productPublicId);

  const row = await variantRepository.findWithImagesByPublicId(
    variantPublicId,
    product.id,
  );

  if (!row) {
    throw new NotFoundError("Variant not found");
  }

  return toVariantDetailResult(row, productPublicId);
}

export async function updateVariant(
  productPublicId: string,
  variantPublicId: string,
  input: UpdateVariantInput,
): Promise<VariantResult> {
  const product = await requireProduct(productPublicId);

  const existing = await variantRepository.findIdByPublicIdAndProduct(
    variantPublicId,
    product.id,
  );

  if (!existing) {
    throw new NotFoundError("Variant not found");
  }

  if (input.sku) {
    const conflict = await variantRepository.findBySku(input.sku, existing.id);
    if (conflict) {
      throw new ConflictError("A variant with this SKU already exists");
    }
  }

  const updated = await variantRepository.updateVariant(existing.id, {
    sku: input.sku,
    barcode: input.barcode,
    color: input.color,
    size: input.size,
    price: input.price,
    cost_price: input.cost_price,
    discount_percentage: input.discount_percentage,
    weight: input.weight,
    length: input.length,
    width: input.width,
    height: input.height,
    status: input.status,
  });

  return toVariantResult(updated, productPublicId);
}

export async function deleteVariant(
  productPublicId: string,
  variantPublicId: string,
): Promise<void> {
  const product = await requireProduct(productPublicId);

  const existing = await variantRepository.findIdByPublicIdAndProduct(
    variantPublicId,
    product.id,
  );

  if (!existing) {
    throw new NotFoundError("Variant not found");
  }

  await variantRepository.softDelete(existing.id);
}
