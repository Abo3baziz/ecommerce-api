import { describe, it, expect } from "vitest";
import {
  createVariantSchema,
  updateVariantSchema,
  variantParamsSchema,
  listVariantsSchema,
} from "../../../src/modules/products/validators/variant.js";

const validBody = {
  sku: "SW-HP-001-BLK-M",
  barcode: "4006381333931",
  color: "Black",
  size: "M",
  price: "129.99",
  cost_price: "85.00",
  discount_percentage: "10.00",
  weight: "0.25",
  length: "18.00",
  width: "16.00",
  height: "8.00",
  status: "ACTIVE",
};

const validParams = { product_public_id: "prd_abc" };

describe("createVariantSchema", () => {
  it("accepts a valid payload", () => {
    const result = createVariantSchema.safeParse({
      params: validParams,
      body: validBody,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a minimal payload with only required fields", () => {
    const result = createVariantSchema.safeParse({
      params: validParams,
      body: { sku: "SW-HP-001", price: "99.99" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing sku", () => {
    const { sku, ...body } = validBody;
    const result = createVariantSchema.safeParse({ params: validParams, body });
    expect(result.success).toBe(false);
  });

  it("rejects a missing price", () => {
    const { price, ...body } = validBody;
    const result = createVariantSchema.safeParse({ params: validParams, body });
    expect(result.success).toBe(false);
  });

  it("rejects a negative price", () => {
    const result = createVariantSchema.safeParse({
      params: validParams,
      body: { sku: "SKU-1", price: "-1.00" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a discount percentage above 100", () => {
    const result = createVariantSchema.safeParse({
      params: validParams,
      body: { ...validBody, discount_percentage: "100.01" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a zero weight", () => {
    const result = createVariantSchema.safeParse({
      params: validParams,
      body: { ...validBody, weight: "0.00" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid status", () => {
    const result = createVariantSchema.safeParse({
      params: validParams,
      body: { ...validBody, status: "PUBLISHED" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing product_public_id param", () => {
    const result = createVariantSchema.safeParse({
      params: {},
      body: validBody,
    });
    expect(result.success).toBe(false);
  });
});

describe("updateVariantSchema", () => {
  it("accepts a partial payload", () => {
    const result = updateVariantSchema.safeParse({
      params: { ...validParams, variant_public_id: "var_abc" },
      body: { price: "119.99" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts null to clear nullable fields", () => {
    const result = updateVariantSchema.safeParse({
      params: { ...validParams, variant_public_id: "var_abc" },
      body: { barcode: null, color: null, size: null, status: null },
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty body", () => {
    const result = updateVariantSchema.safeParse({
      params: { ...validParams, variant_public_id: "var_abc" },
      body: {},
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing variant_public_id param", () => {
    const result = updateVariantSchema.safeParse({
      params: validParams,
      body: { price: "119.99" },
    });
    expect(result.success).toBe(false);
  });
});

describe("variantParamsSchema", () => {
  it("accepts product and variant public ids", () => {
    const result = variantParamsSchema.safeParse({
      params: { product_public_id: "prd_abc", variant_public_id: "var_abc" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing variant_public_id", () => {
    const result = variantParamsSchema.safeParse({ params: validParams });
    expect(result.success).toBe(false);
  });
});

describe("listVariantsSchema", () => {
  it("applies defaults when no query is provided", () => {
    const result = listVariantsSchema.safeParse({
      params: validParams,
      query: {},
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.page).toBe(1);
      expect(result.data.query.limit).toBe(20);
      expect(result.data.query.sort).toBe("created_at");
      expect(result.data.query.include_deleted).toBe(false);
    }
  });

  it("accepts a valid status filter", () => {
    const result = listVariantsSchema.safeParse({
      params: validParams,
      query: { status: "DRAFT" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid status filter", () => {
    const result = listVariantsSchema.safeParse({
      params: validParams,
      query: { status: "PUBLISHED" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a disallowed sort field", () => {
    const result = listVariantsSchema.safeParse({
      params: validParams,
      query: { sort: "name" },
    });
    expect(result.success).toBe(false);
  });
});
