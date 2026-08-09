import { PUBLIC_ID_PREFIXES } from "../../../shared/constants/index.js";
import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import { formatPaginationMeta, generatePublicId } from "../../../shared/utils/index.js";
import { productRepository } from "../repository/product.repository.js";
import { variantRepository } from "../repository/variant.repository.js";
import {
  variantImageRepository,
  type VariantImageRow,
} from "../repository/variantImage.repository.js";
import type {
  CreateVariantImageInput,
  ListVariantImagesResult,
  UpdateVariantImageInput,
  VariantImageResult,
} from "../dto/variantImage.js";

function toVariantImageResult(
  row: VariantImageRow,
  variantPublicId: string,
): VariantImageResult {
  return {
    public_id: row.public_id,
    product_variant_public_id: variantPublicId,
    image_url: row.image_url,
    alt_text: row.alt_text,
    display_order: row.display_order,
  };
}

async function requireVariant(
  productPublicId: string,
  variantPublicId: string,
): Promise<{ product: { id: number }; variant: { id: number } }> {
  const product = await productRepository.findIdByPublicId(productPublicId);

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  const variant = await variantRepository.findIdByPublicIdAndProduct(
    variantPublicId,
    product.id,
  );

  if (!variant) {
    throw new NotFoundError("Variant not found");
  }

  return { product, variant };
}

async function resolveDisplayOrder(
  product_variants_id: number,
  displayOrder: number | undefined,
): Promise<number> {
  if (displayOrder !== undefined) {
    const existing = await variantImageRepository.findByDisplayOrder(
      product_variants_id,
      displayOrder,
    );

    if (existing) {
      throw new ConflictError(
        `Another image of this variant already uses display order ${displayOrder}`,
      );
    }

    return displayOrder;
  }

  const max = await variantImageRepository.findMaxDisplayOrder(product_variants_id);
  return max ? max.display_order + 1 : 0;
}

export async function listVariantImages(
  productPublicId: string,
  variantPublicId: string,
  page: number,
  limit: number,
): Promise<ListVariantImagesResult> {
  const { variant } = await requireVariant(productPublicId, variantPublicId);

  const [rows, total] = await Promise.all([
    variantImageRepository.listByVariant(variant.id, (page - 1) * limit, limit),
    variantImageRepository.countByVariant(variant.id),
  ]);

  return {
    images: rows.map((row) => toVariantImageResult(row, variantPublicId)),
    pagination: formatPaginationMeta(page, limit, total),
  };
}

export async function createVariantImage(
  productPublicId: string,
  variantPublicId: string,
  input: CreateVariantImageInput,
): Promise<VariantImageResult> {
  const { variant } = await requireVariant(productPublicId, variantPublicId);

  const displayOrder = await resolveDisplayOrder(variant.id, input.display_order);

  const created = await variantImageRepository.createImage({
    public_id: generatePublicId(PUBLIC_ID_PREFIXES.VARIANT_IMAGE),
    product_variants_id: variant.id,
    image_url: input.image_url,
    alt_text: input.alt_text ?? null,
    display_order: displayOrder,
  });

  return toVariantImageResult(created, variantPublicId);
}

export async function getVariantImage(
  productPublicId: string,
  variantPublicId: string,
  variantImagePublicId: string,
): Promise<VariantImageResult> {
  const { variant } = await requireVariant(productPublicId, variantPublicId);

  const image = await variantImageRepository.findByPublicIdAndVariant(
    variantImagePublicId,
    variant.id,
  );

  if (!image) {
    throw new NotFoundError("Variant image not found");
  }

  return toVariantImageResult(image, variantPublicId);
}

export async function updateVariantImage(
  productPublicId: string,
  variantPublicId: string,
  variantImagePublicId: string,
  input: UpdateVariantImageInput,
): Promise<VariantImageResult> {
  const { variant } = await requireVariant(productPublicId, variantPublicId);

  const image = await variantImageRepository.findIdByPublicIdAndVariant(
    variantImagePublicId,
    variant.id,
  );

  if (!image) {
    throw new NotFoundError("Variant image not found");
  }

  if (input.display_order !== undefined) {
    const existing = await variantImageRepository.findByDisplayOrder(
      variant.id,
      input.display_order,
    );

    if (existing && existing.id !== image.id) {
      throw new ConflictError(
        `Another image of this variant already uses display order ${input.display_order}`,
      );
    }
  }

  const updated = await variantImageRepository.updateImage(image.id, {
    image_url: input.image_url,
    alt_text: input.alt_text,
    display_order: input.display_order,
  });

  return toVariantImageResult(updated, variantPublicId);
}

export async function deleteVariantImage(
  productPublicId: string,
  variantPublicId: string,
  variantImagePublicId: string,
): Promise<void> {
  const { variant } = await requireVariant(productPublicId, variantPublicId);

  const image = await variantImageRepository.findIdByPublicIdAndVariant(
    variantImagePublicId,
    variant.id,
  );

  if (!image) {
    throw new NotFoundError("Variant image not found");
  }

  await variantImageRepository.deleteImage(image.id);
}
