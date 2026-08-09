import { describe, it, expect } from "vitest";
import {
  createVariantImageSchema,
  updateVariantImageSchema,
  variantImageParamsSchema,
  listVariantImagesSchema,
} from "../../../src/modules/products/validators/variantImage.js";

const validParams = {
  product_public_id: "prd_abc",
  variant_public_id: "var_abc",
};

const validBody = {
  image_url: "https://cdn.test.example/black-side.jpg",
  alt_text: "Wireless headphones in black, side view",
  display_order: 1,
};

describe("createVariantImageSchema", () => {
  it("accepts a valid payload", () => {
    const result = createVariantImageSchema.safeParse({
      params: validParams,
      body: validBody,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a minimal payload with only image_url", () => {
    const result = createVariantImageSchema.safeParse({
      params: validParams,
      body: { image_url: "https://cdn.test.example/black-side.jpg" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing image_url", () => {
    const { image_url, ...body } = validBody;
    const result = createVariantImageSchema.safeParse({
      params: validParams,
      body,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a relative URL", () => {
    const result = createVariantImageSchema.safeParse({
      params: validParams,
      body: { image_url: "/images/black-side.jpg" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative display_order", () => {
    const result = createVariantImageSchema.safeParse({
      params: validParams,
      body: { ...validBody, display_order: -1 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing variant_public_id param", () => {
    const result = createVariantImageSchema.safeParse({
      params: { product_public_id: "prd_abc" },
      body: validBody,
    });
    expect(result.success).toBe(false);
  });
});

describe("updateVariantImageSchema", () => {
  it("accepts a partial payload", () => {
    const result = updateVariantImageSchema.safeParse({
      params: { ...validParams, variant_image_public_id: "vimg_abc" },
      body: { display_order: 2 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts null to clear alt_text", () => {
    const result = updateVariantImageSchema.safeParse({
      params: { ...validParams, variant_image_public_id: "vimg_abc" },
      body: { alt_text: null },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing variant_image_public_id param", () => {
    const result = updateVariantImageSchema.safeParse({
      params: validParams,
      body: { display_order: 2 },
    });
    expect(result.success).toBe(false);
  });
});

describe("variantImageParamsSchema", () => {
  it("accepts all three public ids", () => {
    const result = variantImageParamsSchema.safeParse({
      params: {
        product_public_id: "prd_abc",
        variant_public_id: "var_abc",
        variant_image_public_id: "vimg_abc",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing variant_image_public_id", () => {
    const result = variantImageParamsSchema.safeParse({ params: validParams });
    expect(result.success).toBe(false);
  });
});

describe("listVariantImagesSchema", () => {
  it("applies defaults when no query is provided", () => {
    const result = listVariantImagesSchema.safeParse({
      params: validParams,
      query: {},
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.page).toBe(1);
      expect(result.data.query.limit).toBe(20);
    }
  });
});
