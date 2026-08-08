import type { product_status } from "../../../generated/prisma/enums.js";
import type {
  CreateVariantBody,
  UpdateVariantBody,
} from "../validators/variant.js";
import type { PaginationMeta } from "./common.js";
import type {
  CustomerVariantImageResult,
  VariantImageResult,
} from "./variantImage.js";

export type CreateVariantInput = CreateVariantBody;
export type UpdateVariantInput = UpdateVariantBody;

export interface VariantResult {
  public_id: string;
  product_public_id: string;
  sku: string;
  barcode: string | null;
  color: string | null;
  size: string | null;
  price: string;
  cost_price: string | null;
  discount_percentage: string | null;
  weight: string | null;
  length: string | null;
  width: string | null;
  height: string | null;
  status: product_status | null;
  created_at: Date;
  updated_at: Date;
}

export interface VariantDetailResult extends VariantResult {
  images: VariantImageResult[];
}

export type AdminVariantResult = VariantDetailResult;

export interface CustomerVariantResult {
  public_id: string;
  sku: string;
  color: string | null;
  size: string | null;
  price: string;
  discount_percentage: string | null;
  final_price: string;
  weight: string | null;
  images: CustomerVariantImageResult[];
}

export interface ListVariantsResult {
  variants: VariantResult[];
  pagination: PaginationMeta;
}
