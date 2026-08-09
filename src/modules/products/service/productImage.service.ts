import { prisma } from "../../../config/database.js";
import { PUBLIC_ID_PREFIXES } from "../../../shared/constants/index.js";
import { BadRequestError } from "../../../shared/errors/BadRequestError.js";
import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import { formatPaginationMeta, generatePublicId } from "../../../shared/utils/index.js";
import { productRepository } from "../repository/product.repository.js";
import {
  productImageRepository,
  type ProductImageRow,
} from "../repository/productImage.repository.js";
import type {
  CreateProductImageInput,
  ListProductImagesResult,
  ProductImageResult,
  UpdateProductImageInput,
} from "../dto/productImage.js";

function toProductImageResult(
  row: ProductImageRow,
  productPublicId: string,
): ProductImageResult {
  return {
    public_id: row.public_id,
    product_public_id: productPublicId,
    image_url: row.image_url,
    alt_text: row.alt_text,
    display_order: row.display_order,
    is_primary: row.is_primary,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

async function requireProduct(productPublicId: string): Promise<{ id: number }> {
  const product = await productRepository.findIdByPublicId(productPublicId);

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  return product;
}

async function resolveDisplayOrder(
  products_id: number,
  displayOrder: number | undefined,
): Promise<number> {
  if (displayOrder !== undefined) {
    const existing = await productImageRepository.findByDisplayOrder(
      products_id,
      displayOrder,
    );

    if (existing) {
      throw new ConflictError(
        `Another image of this product already uses display order ${displayOrder}`,
      );
    }

    return displayOrder;
  }

  const max = await productImageRepository.findMaxDisplayOrder(products_id);
  return max ? max.display_order + 1 : 0;
}

export async function listProductImages(
  productPublicId: string,
  page: number,
  limit: number,
): Promise<ListProductImagesResult> {
  const product = await requireProduct(productPublicId);

  const [rows, total] = await Promise.all([
    productImageRepository.listByProduct(product.id, (page - 1) * limit, limit),
    productImageRepository.countByProduct(product.id),
  ]);

  return {
    images: rows.map((row) => toProductImageResult(row, productPublicId)),
    pagination: formatPaginationMeta(page, limit, total),
  };
}

export async function createProductImage(
  productPublicId: string,
  input: CreateProductImageInput,
): Promise<ProductImageResult> {
  const product = await requireProduct(productPublicId);

  const displayOrder = await resolveDisplayOrder(product.id, input.display_order);
  const imageCount = await productImageRepository.countByProduct(product.id);
  const isPrimary = input.is_primary === true || imageCount === 0;

  const created = await prisma.$transaction(async (tx) => {
    if (isPrimary) {
      await productImageRepository.clearPrimary(product.id, null, tx);
    }

    return productImageRepository.createImage(
      {
        public_id: generatePublicId(PUBLIC_ID_PREFIXES.PRODUCT_IMAGE),
        products_id: product.id,
        image_url: input.image_url,
        alt_text: input.alt_text ?? null,
        display_order: displayOrder,
        is_primary: isPrimary,
      },
      tx,
    );
  });

  return toProductImageResult(created, productPublicId);
}

export async function getProductImage(
  productPublicId: string,
  imagePublicId: string,
): Promise<ProductImageResult> {
  const product = await requireProduct(productPublicId);

  const image = await productImageRepository.findByPublicIdAndProduct(
    imagePublicId,
    product.id,
  );

  if (!image) {
    throw new NotFoundError("Product image not found");
  }

  return toProductImageResult(image, productPublicId);
}

export async function updateProductImage(
  productPublicId: string,
  imagePublicId: string,
  input: UpdateProductImageInput,
): Promise<ProductImageResult> {
  const product = await requireProduct(productPublicId);

  const image = await productImageRepository.findIdByPublicIdAndProduct(
    imagePublicId,
    product.id,
  );

  if (!image) {
    throw new NotFoundError("Product image not found");
  }

  if (input.is_primary === false && image.is_primary) {
    const imageCount = await productImageRepository.countByProduct(product.id);

    if (imageCount === 1) {
      throw new BadRequestError(
        "Cannot clear the primary flag on the product's only image",
      );
    }

    throw new BadRequestError("Cannot clear the primary flag; promote another image instead");
  }

  if (input.display_order !== undefined) {
    const existing = await productImageRepository.findByDisplayOrder(
      product.id,
      input.display_order,
    );

    if (existing && existing.id !== image.id) {
      throw new ConflictError(
        `Another image of this product already uses display order ${input.display_order}`,
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (input.is_primary === true) {
      await productImageRepository.clearPrimary(product.id, image.id, tx);
    }

    return productImageRepository.updateImage(
      image.id,
      {
        image_url: input.image_url,
        alt_text: input.alt_text,
        display_order: input.display_order,
        is_primary: input.is_primary,
      },
      tx,
    );
  });

  return toProductImageResult(updated, productPublicId);
}

export async function deleteProductImage(
  productPublicId: string,
  imagePublicId: string,
): Promise<void> {
  const product = await requireProduct(productPublicId);

  const image = await productImageRepository.findIdByPublicIdAndProduct(
    imagePublicId,
    product.id,
  );

  if (!image) {
    throw new NotFoundError("Product image not found");
  }

  await prisma.$transaction(async (tx) => {
    if (image.is_primary) {
      const next = await productImageRepository.findLowestOrderImage(
        product.id,
        image.id,
        tx,
      );

      if (next) {
        await productImageRepository.setPrimary(next.id, tx);
      }
    }

    await productImageRepository.deleteImage(image.id, tx);
  });
}
