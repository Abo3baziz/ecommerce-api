import { Request, Response, NextFunction } from "express";
import {
  assignProductToCategory,
  createCategory,
  deleteCategory,
  getAdminCategory,
  getCategory,
  listAdminCategories,
  listCategories,
  listCategoryProducts,
  unassignProductFromCategory,
  updateCategory,
} from "../service/category.service.js";
import type {
  CategoryParams,
  CategoryProductParams,
  CreateCategoryBody,
  ListAdminCategoriesQuery,
  ListCategoriesQuery,
  ListCategoryProductsQuery,
  UpdateCategoryBody,
} from "../validators/category.js";

export async function listCategoriesController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { page, limit, search, sort } = req.query as unknown as ListCategoriesQuery;
    const result = await listCategories(page, limit, search, sort);
    res.status(200).json({
      success: true,
      data: result.categories,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCategoryController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { category_public_id } = req.params as CategoryParams;
    const data = await getCategory(category_public_id);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function listCategoryProductsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { category_public_id } = req.params as CategoryParams;
    const { page, limit, search, sort } =
      req.query as unknown as ListCategoryProductsQuery;
    const result = await listCategoryProducts(
      category_public_id,
      page,
      limit,
      search,
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

export async function listAdminCategoriesController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { page, limit, search, is_active, include_deleted, sort } =
      req.query as unknown as ListAdminCategoriesQuery;
    const result = await listAdminCategories(
      page,
      limit,
      search,
      is_active,
      include_deleted,
      sort,
    );
    res.status(200).json({
      success: true,
      data: result.categories,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function createCategoryController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await createCategory(req.body as CreateCategoryBody);
    res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminCategoryController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { category_public_id } = req.params as CategoryParams;
    const data = await getAdminCategory(category_public_id);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCategoryController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { category_public_id } = req.params as CategoryParams;
    const data = await updateCategory(
      category_public_id,
      req.body as UpdateCategoryBody,
    );
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteCategoryController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { category_public_id } = req.params as CategoryParams;
    await deleteCategory(category_public_id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function assignProductController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { category_public_id, product_public_id } =
      req.params as CategoryProductParams;
    await assignProductToCategory(category_public_id, product_public_id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function unassignProductController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { category_public_id, product_public_id } =
      req.params as CategoryProductParams;
    await unassignProductFromCategory(category_public_id, product_public_id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
