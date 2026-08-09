import type {
  CreateProductImageBody,
  UpdateProductImageBody,
} from "../validators/productImage.js";
import type { PaginationMeta } from "./common.js";

export type CreateProductImageInput = CreateProductImageBody;
export type UpdateProductImageInput = UpdateProductImageBody;

export interface ProductImageResult {
  public_id: string;
  product_public_id: string;
  image_url: string;
  alt_text: string | null;
  display_order: number;
  is_primary: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface CustomerProductImageResult {
  public_id: string;
  image_url: string;
  alt_text: string | null;
  display_order: number;
  is_primary: boolean;
}

export interface ListProductImagesResult {
  images: ProductImageResult[];
  pagination: PaginationMeta;
}
