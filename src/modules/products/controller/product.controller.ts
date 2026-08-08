import { Request, Response, NextFunction } from "express";
import {
  createProduct,
  deleteProduct,
  getAdminProduct,
  getProduct,
  listAdminProducts,
  listProducts,
  updateProduct,
} from "../service/product.service.js";
import type {
  CreateProductBody,
  GetAdminProductQuery,
  ListAdminProductsQuery,
  ListProductsQuery,
  ProductParams,
  UpdateProductBody,
} from "../validators/product.js";

export async function listProductsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { page, limit, search, brand, sort } =
      req.query as unknown as ListProductsQuery;
    const result = await listProducts(page, limit, search, brand, sort);
    res.status(200).json({
      success: true,
      data: result.products,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function getProductController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { product_public_id } = req.params as ProductParams;
    const data = await getProduct(product_public_id);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function listAdminProductsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { page, limit, search, brand, include_deleted, sort } =
      req.query as unknown as ListAdminProductsQuery;
    const result = await listAdminProducts(
      page,
      limit,
      search,
      brand,
      include_deleted,
      sort,
    );
    res.status(200).json({
      success: true,
      data: result.products,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function createProductController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await createProduct(req.body as CreateProductBody);
    res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminProductController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { product_public_id } = req.params as ProductParams;
    const { include_deleted_variants } =
      req.query as unknown as GetAdminProductQuery;
    const data = await getAdminProduct(
      product_public_id,
      include_deleted_variants,
    );
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateProductController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { product_public_id } = req.params as ProductParams;
    const data = await updateProduct(
      product_public_id,
      req.body as UpdateProductBody,
    );
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteProductController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { product_public_id } = req.params as ProductParams;
    await deleteProduct(product_public_id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
