export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export function computeQuantityAvailable(
  quantityOnHand: number,
  quantityReserved: number | null,
): number {
  return quantityOnHand - (quantityReserved ?? 0);
}

export function computeStockStatus(
  quantityAvailable: number,
  reorderLevel: number | null,
): StockStatus {
  if (quantityAvailable <= 0) {
    return "OUT_OF_STOCK";
  }

  if (reorderLevel !== null && quantityAvailable <= reorderLevel) {
    return "LOW_STOCK";
  }

  return "IN_STOCK";
}
