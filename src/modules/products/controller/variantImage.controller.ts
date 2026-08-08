import { Request, Response, NextFunction } from "express";
import {
  createVariantImage,
  deleteVariantImage,
  getVariantImage,
  listVariantImages,
  updateVariantImage,
} from "../service/variantImage.service.js";
import type {
  CreateVariantImageBody,
  ListVariantImagesQuery,
  UpdateVariantImageBody,
  VariantImageParams,
} from "../validators/variantImage.js";

export async function listVariantImagesController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { product_public_id, variant_public_id } =
      req.params as VariantImageParams;
    const { page, limit } = req.query as unknown as ListVariantImagesQuery;
    const result = await listVariantImages(
      product_public_id,
      variant_public_id,
      page,
      limit,
    );
    res.status(200).json({
      success: true,
      data: result.images,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function createVariantImageController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { product_public_id, variant_public_id } =
      req.params as VariantImageParams;
    const data = await createVariantImage(
      product_public_id,
      variant_public_id,
      req.body as CreateVariantImageBody,
    );
    res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function getVariantImageController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { product_public_id, variant_public_id, variant_image_public_id } =
      req.params as VariantImageParams;
    const data = await getVariantImage(
      product_public_id,
      variant_public_id,
      variant_image_public_id,
    );
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateVariantImageController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { product_public_id, variant_public_id, variant_image_public_id } =
      req.params as VariantImageParams;
    const data = await updateVariantImage(
      product_public_id,
      variant_public_id,
      variant_image_public_id,
      req.body as UpdateVariantImageBody,
    );
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteVariantImageController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { product_public_id, variant_public_id, variant_image_public_id } =
      req.params as VariantImageParams;
    await deleteVariantImage(
      product_public_id,
      variant_public_id,
      variant_image_public_id,
    );
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
