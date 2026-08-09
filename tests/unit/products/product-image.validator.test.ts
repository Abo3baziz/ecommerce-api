import { describe, it, expect } from "vitest";
import {
  createProductImageSchema,
  updateProductImageSchema,
  productImageParamsSchema,
  listProductImagesSchema,
} from "../../../src/modules/products/validators/productImage.js";

const validParams = { product_public_id: "prd_abc" };

const validBody = {
  image_url: "https://cdn.test.example/hero.jpg",
  alt_text: "Wireless headphones in black",
  display_order: 1,
  is_primary: true,
};

describe("createProductImageSchema", () => {
  it("accepts a valid payload", () => {
    const result = createProductImageSchema.safeParse({
      params: validParams,
      body: validBody,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a minimal payload with only image_url", () => {
    const result = createProductImageSchema.safeParse({
      params: validParams,
      body: { image_url: "https://cdn.test.example/hero.jpg" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing image_url", () => {
    const { image_url, ...body } = validBody;
    const result = createProductImageSchema.safeParse({
      params: validParams,
      body,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-http(s) URL", () => {
    const result = createProductImageSchema.safeParse({
      params: validParams,
      body: { image_url: "ftp://cdn.test.example/hero.jpg" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a negative display_order", () => {
    const result = createProductImageSchema.safeParse({
      params: validParams,
      body: { ...validBody, display_order: -1 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-boolean is_primary", () => {
    const result = createProductImageSchema.safeParse({
      params: validParams,
      body: { ...validBody, is_primary: "yes" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing product_public_id param", () => {
    const result = createProductImageSchema.safeParse({
      params: {},
      body: validBody,
    });
    expect(result.success).toBe(false);
  });
});

describe("updateProductImageSchema", () => {
  it("accepts a partial payload", () => {
    const result = updateProductImageSchema.safeParse({
      params: { ...validParams, image_public_id: "pimg_abc" },
      body: { alt_text: "New alt text" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts null to clear alt_text", () => {
    const result = updateProductImageSchema.safeParse({
      params: { ...validParams, image_public_id: "pimg_abc" },
      body: { alt_text: null },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing image_public_id param", () => {
    const result = updateProductImageSchema.safeParse({
      params: validParams,
      body: { alt_text: "New alt text" },
    });
    expect(result.success).toBe(false);
  });
});

describe("productImageParamsSchema", () => {
  it("accepts product and image public ids", () => {
    const result = productImageParamsSchema.safeParse({
      params: { product_public_id: "prd_abc", image_public_id: "pimg_abc" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing image_public_id", () => {
    const result = productImageParamsSchema.safeParse({ params: validParams });
    expect(result.success).toBe(false);
  });
});

describe("listProductImagesSchema", () => {
  it("applies defaults when no query is provided", () => {
    const result = listProductImagesSchema.safeParse({
      params: validParams,
      query: {},
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.page).toBe(1);
      expect(result.data.query.limit).toBe(20);
    }
  });

  it("coerces numeric query values", () => {
    const result = listProductImagesSchema.safeParse({
      params: validParams,
      query: { page: "2", limit: "5" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.page).toBe(2);
      expect(result.data.query.limit).toBe(5);
    }
  });
});
