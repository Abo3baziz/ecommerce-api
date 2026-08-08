import { Request, Response, NextFunction } from "express";
import {
  createProductImage,
  deleteProductImage,
  getProductImage,
  listProductImages,
  updateProductImage,
} from "../service/productImage.service.js";
import type {
  CreateProductImageBody,
  ListProductImagesQuery,
  ProductImageParams,
  UpdateProductImageBody,
} from "../validators/productImage.js";

export async function listProductImagesController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { product_public_id } = req.params as ProductImageParams;
    const { page, limit } = req.query as unknown as ListProductImagesQuery;
    const result = await listProductImages(product_public_id, page, limit);
    res.status(200).json({
      success: true,
      data: result.images,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function createProductImageController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { product_public_id } = req.params as ProductImageParams;
    const data = await createProductImage(
      product_public_id,
      req.body as CreateProductImageBody,
    );
    res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function getProductImageController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { product_public_id, image_public_id } =
      req.params as ProductImageParams;
    const data = await getProductImage(product_public_id, image_public_id);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateProductImageController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { product_public_id, image_public_id } =
      req.params as ProductImageParams;
    const data = await updateProductImage(
      product_public_id,
      image_public_id,
      req.body as UpdateProductImageBody,
    );
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteProductImageController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { product_public_id, image_public_id } =
      req.params as ProductImageParams;
    await deleteProductImage(product_public_id, image_public_id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
