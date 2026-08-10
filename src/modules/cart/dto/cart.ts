import type {
  AddCartItemBody,
  UpdateCartItemBody,
} from "../validators/cart.js";

export type AddCartItemInput = AddCartItemBody;
export type UpdateCartItemInput = UpdateCartItemBody;

export interface CartLineItemResult {
  variant_public_id: string;
  product_public_id: string;
  product_name: string;
  product_slug: string;
  sku: string;
  color: string | null;
  size: string | null;
  image_url: string | null;
  price: string;
  discount_percentage: string | null;
  final_price: string;
  quantity: number;
  line_total: string;
  created_at: Date;
  updated_at: Date;
}

export interface CartResult {
  public_id: string;
  items_count: number;
  total_quantity: number;
  subtotal: string;
  items: CartLineItemResult[];
  created_at: Date;
  updated_at: Date;
}
