import type {
  CreateProductBody,
  UpdateProductBody,
} from "../validators/product.js";
import type { PaginationMeta } from "./common.js";
import type {
  AdminVariantResult,
  CustomerVariantResult,
} from "./variant.js";
import type {
  CustomerProductImageResult,
  ProductImageResult,
} from "./productImage.js";

export type {
  AdminVariantResult,
  CustomerVariantResult,
} from "./variant.js";

export type CreateProductInput = CreateProductBody;
export type UpdateProductInput = UpdateProductBody;

export interface ProductResult {
  public_id: string;
  slug: string;
  name: string;
  description: string | null;
  brand: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CustomerProductDetailResult extends ProductResult {
  variants: CustomerVariantResult[];
  images: CustomerProductImageResult[];
}

export interface AdminProductDetailResult extends ProductResult {
  variants: AdminVariantResult[];
  images: ProductImageResult[];
}

export interface ListProductsResult {
  products: ProductResult[];
  pagination: PaginationMeta;
}
