import { prisma } from "../../src/config/database.js";

export interface CreateInventoryOverrides {
  quantity_on_hand?: number;
  quantity_reserved?: number | null;
  reorder_level?: number | null;
  created_at?: Date;
  last_stock_update?: Date;
}

export async function createInventory(
  productVariantsId: number,
  overrides: CreateInventoryOverrides = {},
) {
  const now = new Date();

  return prisma.inventory.create({
    data: {
      product_variants_id: productVariantsId,
      quantity_on_hand: overrides.quantity_on_hand ?? 100,
      quantity_reserved: overrides.quantity_reserved ?? null,
      reorder_level: overrides.reorder_level ?? 20,
      created_at: overrides.created_at ?? now,
      last_stock_update: overrides.last_stock_update ?? now,
    },
  });
}
