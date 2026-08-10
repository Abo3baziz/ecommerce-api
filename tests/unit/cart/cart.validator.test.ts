import { describe, it, expect } from "vitest";
import {
  addCartItemSchema,
  cartItemParamsSchema,
  updateCartItemSchema,
} from "../../../src/modules/cart/validators/cart.js";

describe("addCartItemSchema", () => {
  it("accepts a valid payload", () => {
    const result = addCartItemSchema.safeParse({
      body: {
        variant_public_id: "var_abc",
        quantity: 2,
      },
    });
    expect(result.success).toBe(true);
  });

  it("defaults quantity to 1 when omitted", () => {
    const result = addCartItemSchema.safeParse({
      body: { variant_public_id: "var_abc" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.body.quantity).toBe(1);
    }
  });

  it("accepts quantity of 1 and 999 (boundary values)", () => {
    const min = addCartItemSchema.safeParse({
      body: { variant_public_id: "var_abc", quantity: 1 },
    });
    const max = addCartItemSchema.safeParse({
      body: { variant_public_id: "var_abc", quantity: 999 },
    });
    expect(min.success).toBe(true);
    expect(max.success).toBe(true);
  });

  it("rejects a missing variant_public_id", () => {
    const result = addCartItemSchema.safeParse({
      body: { quantity: 1 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty variant_public_id", () => {
    const result = addCartItemSchema.safeParse({
      body: { variant_public_id: "", quantity: 1 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a quantity below 1", () => {
    const result = addCartItemSchema.safeParse({
      body: { variant_public_id: "var_abc", quantity: 0 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a quantity above 999", () => {
    const result = addCartItemSchema.safeParse({
      body: { variant_public_id: "var_abc", quantity: 1000 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer quantity", () => {
    const result = addCartItemSchema.safeParse({
      body: { variant_public_id: "var_abc", quantity: 1.5 },
    });
    expect(result.success).toBe(false);
  });
});

describe("cartItemParamsSchema", () => {
  it("accepts a valid variant_public_id", () => {
    const result = cartItemParamsSchema.safeParse({
      params: { variant_public_id: "var_abc" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing variant_public_id", () => {
    const result = cartItemParamsSchema.safeParse({ params: {} });
    expect(result.success).toBe(false);
  });
});

describe("updateCartItemSchema", () => {
  const params = { variant_public_id: "var_abc" };

  it("accepts a valid body", () => {
    const result = updateCartItemSchema.safeParse({
      params,
      body: { quantity: 4 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing quantity", () => {
    const result = updateCartItemSchema.safeParse({ params, body: {} });
    expect(result.success).toBe(false);
  });

  it("rejects a quantity below 1", () => {
    const result = updateCartItemSchema.safeParse({
      params,
      body: { quantity: 0 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a quantity above 999", () => {
    const result = updateCartItemSchema.safeParse({
      params,
      body: { quantity: 1000 },
    });
    expect(result.success).toBe(false);
  });
});
