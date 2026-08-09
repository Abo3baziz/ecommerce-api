import { describe, it, expect } from "vitest";
import {
  createInventorySchema,
  updateInventorySchema,
  inventoryParamsSchema,
  listInventorySchema,
} from "../../../src/modules/inventory/validators/inventory.js";

describe("createInventorySchema", () => {
  it("accepts a valid payload", () => {
    const result = createInventorySchema.safeParse({
      body: {
        variant_public_id: "var_abc",
        quantity_on_hand: 100,
        reorder_level: 20,
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a minimal payload without reorder_level", () => {
    const result = createInventorySchema.safeParse({
      body: { variant_public_id: "var_abc", quantity_on_hand: 0 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing variant_public_id", () => {
    const result = createInventorySchema.safeParse({
      body: { quantity_on_hand: 10 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing quantity_on_hand", () => {
    const result = createInventorySchema.safeParse({
      body: { variant_public_id: "var_abc" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative quantity_on_hand", () => {
    const result = createInventorySchema.safeParse({
      body: { variant_public_id: "var_abc", quantity_on_hand: -1 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer quantity_on_hand", () => {
    const result = createInventorySchema.safeParse({
      body: { variant_public_id: "var_abc", quantity_on_hand: 10.5 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative reorder_level", () => {
    const result = createInventorySchema.safeParse({
      body: {
        variant_public_id: "var_abc",
        quantity_on_hand: 10,
        reorder_level: -1,
      },
    });
    expect(result.success).toBe(false);
  });
});

describe("updateInventorySchema", () => {
  const params = { variant_public_id: "var_abc" };

  it("accepts an absolute quantity_on_hand", () => {
    const result = updateInventorySchema.safeParse({
      params,
      body: { quantity_on_hand: 50 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a positive quantity_change", () => {
    const result = updateInventorySchema.safeParse({
      params,
      body: { quantity_change: 15 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a negative quantity_change with a reason", () => {
    const result = updateInventorySchema.safeParse({
      params,
      body: { quantity_change: -15, reason: "Damaged units written off" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts reorder_level null to clear the threshold", () => {
    const result = updateInventorySchema.safeParse({
      params,
      body: { reorder_level: null },
    });
    expect(result.success).toBe(true);
  });

  it("accepts reorder_level updates without quantity changes", () => {
    const result = updateInventorySchema.safeParse({
      params,
      body: { reorder_level: 10 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty body", () => {
    const result = updateInventorySchema.safeParse({ params, body: {} });
    expect(result.success).toBe(false);
  });

  it("rejects sending both quantity_on_hand and quantity_change", () => {
    const result = updateInventorySchema.safeParse({
      params,
      body: { quantity_on_hand: 50, quantity_change: 10 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a quantity_change of zero", () => {
    const result = updateInventorySchema.safeParse({
      params,
      body: { quantity_change: 0 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative quantity_on_hand", () => {
    const result = updateInventorySchema.safeParse({
      params,
      body: { quantity_on_hand: -5 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative reorder_level", () => {
    const result = updateInventorySchema.safeParse({
      params,
      body: { reorder_level: -1 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an over-long reason", () => {
    const result = updateInventorySchema.safeParse({
      params,
      body: { quantity_change: 1, reason: "x".repeat(256) },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing variant_public_id param", () => {
    const result = updateInventorySchema.safeParse({
      params: {},
      body: { quantity_change: 1 },
    });
    expect(result.success).toBe(false);
  });
});

describe("inventoryParamsSchema", () => {
  it("accepts a variant public id", () => {
    const result = inventoryParamsSchema.safeParse({
      params: { variant_public_id: "var_abc" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing variant_public_id", () => {
    const result = inventoryParamsSchema.safeParse({ params: {} });
    expect(result.success).toBe(false);
  });
});

describe("listInventorySchema", () => {
  it("applies defaults when no query is provided", () => {
    const result = listInventorySchema.safeParse({ query: {} });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.page).toBe(1);
      expect(result.data.query.limit).toBe(20);
      expect(result.data.query.sort).toBe("product_name");
      expect(result.data.query.include_deleted).toBe(false);
    }
  });

  it("coerces numeric query values", () => {
    const result = listInventorySchema.safeParse({
      query: { page: "2", limit: "10" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.page).toBe(2);
      expect(result.data.query.limit).toBe(10);
    }
  });

  it("accepts an allowed sort field", () => {
    const result = listInventorySchema.safeParse({
      query: { sort: "-quantity_available" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a disallowed sort field", () => {
    const result = listInventorySchema.safeParse({ query: { sort: "price" } });
    expect(result.success).toBe(false);
  });

  it("rejects a limit above 100", () => {
    const result = listInventorySchema.safeParse({ query: { limit: "101" } });
    expect(result.success).toBe(false);
  });

  it("accepts a valid stock_status", () => {
    const result = listInventorySchema.safeParse({
      query: { stock_status: "LOW_STOCK" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.stock_status).toBe("LOW_STOCK");
    }
  });

  it("rejects an invalid stock_status", () => {
    const result = listInventorySchema.safeParse({
      query: { stock_status: "SOLD_OUT" },
    });
    expect(result.success).toBe(false);
  });

  it("parses include_deleted as a boolean with default false", () => {
    const defaultResult = listInventorySchema.safeParse({ query: {} });
    expect(defaultResult.success).toBe(true);
    if (defaultResult.success) {
      expect(defaultResult.data.query.include_deleted).toBe(false);
    }

    const result = listInventorySchema.safeParse({
      query: { include_deleted: "true" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.include_deleted).toBe(true);
    }
  });
});
