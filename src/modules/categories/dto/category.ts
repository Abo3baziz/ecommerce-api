import type {
  CreateCategoryBody,
  UpdateCategoryBody,
} from "../validators/category.js";
import type { PaginationMeta } from "./common.js";
import type { ProductResult } from "../../products/dto/product.js";

export type { ProductResult } from "../../products/dto/product.js";

export type CreateCategoryInput = CreateCategoryBody;
export type UpdateCategoryInput = UpdateCategoryBody;

export interface CategoryResult {
  public_id: string;
  name: string;
  slug: string;
  description: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface AdminCategoryResult extends CategoryResult {
  is_active: boolean;
}

export interface CustomerCategoryDetailResult extends CategoryResult {
  product_count: number;
}

export interface AdminCategoryDetailResult extends AdminCategoryResult {
  product_count: number;
}

export interface ListCategoriesResult {
  categories: CategoryResult[];
  pagination: PaginationMeta;
}

export interface ListAdminCategoriesResult {
  categories: AdminCategoryResult[];
  pagination: PaginationMeta;
}

export interface ListCategoryProductsResult {
  products: ProductResult[];
  pagination: PaginationMeta;
}
