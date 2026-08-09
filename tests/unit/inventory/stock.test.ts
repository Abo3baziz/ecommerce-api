import { describe, it, expect } from "vitest";
import {
  computeQuantityAvailable,
  computeStockStatus,
} from "../../../src/modules/inventory/utils/stock.js";

describe("computeQuantityAvailable", () => {
  it("subtracts the reserved quantity from the on-hand quantity", () => {
    expect(computeQuantityAvailable(100, 5)).toBe(95);
  });

  it("treats a null reserved quantity as zero", () => {
    expect(computeQuantityAvailable(100, null)).toBe(100);
  });

  it("treats a zero reserved quantity as zero", () => {
    expect(computeQuantityAvailable(100, 0)).toBe(100);
  });

  it("surfaces a negative availability as-is", () => {
    expect(computeQuantityAvailable(3, 5)).toBe(-2);
  });
});

describe("computeStockStatus", () => {
  it("returns OUT_OF_STOCK when available is zero", () => {
    expect(computeStockStatus(0, 20)).toBe("OUT_OF_STOCK");
  });

  it("returns OUT_OF_STOCK when available is negative even with a reorder level", () => {
    expect(computeStockStatus(-2, 20)).toBe("OUT_OF_STOCK");
  });

  it("returns OUT_OF_STOCK when available is zero and no reorder level is set", () => {
    expect(computeStockStatus(0, null)).toBe("OUT_OF_STOCK");
  });

  it("returns LOW_STOCK when available is at the reorder level", () => {
    expect(computeStockStatus(20, 20)).toBe("LOW_STOCK");
  });

  it("returns LOW_STOCK when available is below the reorder level", () => {
    expect(computeStockStatus(15, 20)).toBe("LOW_STOCK");
  });

  it("returns IN_STOCK when available is above the reorder level", () => {
    expect(computeStockStatus(100, 20)).toBe("IN_STOCK");
  });

  it("returns IN_STOCK when no reorder level is set and stock is positive", () => {
    expect(computeStockStatus(100, null)).toBe("IN_STOCK");
  });
});
