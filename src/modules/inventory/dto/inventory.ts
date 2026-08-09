import type {
  CreateInventoryBody,
  UpdateInventoryBody,
} from "../validators/inventory.js";
import type { PaginationMeta } from "./common.js";
import type { StockStatus } from "../utils/stock.js";

export type { StockStatus } from "../utils/stock.js";

export type CreateInventoryInput = CreateInventoryBody;
export type UpdateInventoryInput = UpdateInventoryBody;

export interface InventoryResult {
  public_id: string;
  product_public_id: string;
  product_name: string;
  sku: string;
  barcode: string | null;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  reorder_level: number | null;
  stock_status: StockStatus;
  created_at: Date;
  last_stock_update: Date;
}

export interface ListInventoryResult {
  inventory: InventoryResult[];
  pagination: PaginationMeta;
}
