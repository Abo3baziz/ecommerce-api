import type { PlaceOrderBody, ListOrdersQuery } from "../validators/orders.js";
import type {
  ListAdminOrdersQuery,
  UpdateOrderStatusBody,
} from "../validators/admin.js";
import type { PaginationMeta } from "./common.js";

export type { ListOrdersQuery, ListAdminOrdersQuery, UpdateOrderStatusBody };

export type PlaceOrderInput = PlaceOrderBody;

export interface ShippingAddressResult {
  recipient_name: string;
  phone_number: string;
  country: string;
  state: string | null;
  city: string;
  address_1: string;
  address_2: string | null;
  postal_code: string | null;
}

export interface OrderItemResult {
  product_public_id: string;
  variant_public_id: string;
  product_name: string;
  product_slug: string;
  sku: string;
  color: string | null;
  size: string | null;
  unit_price: string;
  discount_percentage: string | null;
  quantity: number;
  total_amount: string;
  created_at: Date;
}

export interface PaymentResult {
  public_id: string;
  status: string;
  method: string;
  provider: string;
  transaction_reference: string | null;
  amount: string;
  paid_at: Date | null;
}

export interface OrderResult {
  public_id: string;
  order_number: string;
  status: string;
  placed_at: Date;
  subtotal: string;
  discount_amount: string;
  shipping_fee: string;
  tax_amount: string;
  total_amount: string;
  notes: string | null;
  shipping_address: ShippingAddressResult;
  payment: PaymentResult | null;
  items: OrderItemResult[];
  created_at: Date;
  updated_at: Date;
}

export interface ListOrdersResult {
  orders: OrderResult[];
  pagination: PaginationMeta;
}

export interface ShipmentResult {
  public_id: string;
  status: string;
  carrier: string | null;
  tracking_number: string | null;
  shipped_at: Date | null;
  delivered_at: Date | null;
}

export interface AdminOrderResult extends OrderResult {
  shipment: ShipmentResult;
  customer_public_id: string;
  customer_name: string;
  customer_email: string;
  customer_phone_number: string;
}

export interface AdminListOrderRow {
  public_id: string;
  order_number: string;
  status: string;
  placed_at: Date;
  subtotal: string;
  discount_amount: string;
  shipping_fee: string;
  tax_amount: string;
  total_amount: string;
  customer_public_id: string;
  customer_name: string;
  customer_email: string;
  created_at: Date;
  updated_at: Date;
}

export interface ListAdminOrdersResult {
  orders: AdminListOrderRow[];
  pagination: PaginationMeta;
}
