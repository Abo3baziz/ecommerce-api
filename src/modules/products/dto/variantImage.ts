import type {
  CreateVariantImageBody,
  UpdateVariantImageBody,
} from "../validators/variantImage.js";
import type { PaginationMeta } from "./common.js";

export type CreateVariantImageInput = CreateVariantImageBody;
export type UpdateVariantImageInput = UpdateVariantImageBody;

export interface VariantImageResult {
  public_id: string;
  product_variant_public_id: string;
  image_url: string;
  alt_text: string | null;
  display_order: number;
}

export interface CustomerVariantImageResult {
  public_id: string;
  image_url: string;
  alt_text: string | null;
  display_order: number;
}

export interface ListVariantImagesResult {
  images: VariantImageResult[];
  pagination: PaginationMeta;
}
