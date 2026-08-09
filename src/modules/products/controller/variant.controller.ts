import { Request, Response, NextFunction } from "express";
import {
  createVariant,
  deleteVariant,
  getVariant,
  listVariants,
  updateVariant,
} from "../service/variant.service.js";
import type {
  CreateVariantBody,
  ListVariantsQuery,
  UpdateVariantBody,
  VariantParams,
} from "../validators/variant.js";

export async function listVariantsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { product_public_id } = req.params as VariantParams;
    const { page, limit, status, include_deleted, sort } =
      req.query as unknown as ListVariantsQuery;
    const result = await listVariants(
      product_public_id,
      page,
      limit,
      status,
      include_deleted,
      sort,
    );
    res.status(200).json({
      success: true,
      data: result.variants,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function createVariantController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { product_public_id } = req.params as VariantParams;
    const data = await createVariant(
      product_public_id,
      req.body as CreateVariantBody,
    );
    res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function getVariantController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { product_public_id, variant_public_id } =
      req.params as VariantParams;
    const data = await getVariant(product_public_id, variant_public_id);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateVariantController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { product_public_id, variant_public_id } =
      req.params as VariantParams;
    const data = await updateVariant(
      product_public_id,
      variant_public_id,
      req.body as UpdateVariantBody,
    );
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteVariantController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { product_public_id, variant_public_id } =
      req.params as VariantParams;
    await deleteVariant(product_public_id, variant_public_id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
