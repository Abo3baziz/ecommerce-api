import { describe, it, expect } from "vitest";
import {
  createProductSchema,
  updateProductSchema,
  productParamsSchema,
  listProductsSchema,
  listAdminProductsSchema,
  getAdminProductSchema,
} from "../../../src/modules/products/validators/product.js";

const validBody = {
  name: "Wireless Noise-Cancelling Headphones",
  slug: "wireless-noise-cancelling-headphones",
  description: "Premium over-ear headphones.",
  brand: "SoundWave",
};

describe("createProductSchema", () => {
  it("accepts a valid payload", () => {
    const result = createProductSchema.safeParse({ body: validBody });
    expect(result.success).toBe(true);
  });

  it("accepts a minimal payload without optional fields", () => {
    const result = createProductSchema.safeParse({
      body: { name: "Headphones" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing name", () => {
    const { name, ...body } = validBody;
    const result = createProductSchema.safeParse({ body });
    expect(result.success).toBe(false);
  });

  it("rejects a blank name", () => {
    const result = createProductSchema.safeParse({
      body: { ...validBody, name: "   " },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed slug", () => {
    const result = createProductSchema.safeParse({
      body: { ...validBody, slug: "Invalid Slug!" },
    });
    expect(result.success).toBe(false);
  });
});

describe("updateProductSchema", () => {
  it("accepts a partial payload", () => {
    const result = updateProductSchema.safeParse({
      params: { product_public_id: "prd_abc" },
      body: { name: "New Name" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts null to clear description and brand", () => {
    const result = updateProductSchema.safeParse({
      params: { product_public_id: "prd_abc" },
      body: { description: null, brand: null },
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty body", () => {
    const result = updateProductSchema.safeParse({
      params: { product_public_id: "prd_abc" },
      body: {},
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing product_public_id param", () => {
    const result = updateProductSchema.safeParse({
      params: {},
      body: { name: "New Name" },
    });
    expect(result.success).toBe(false);
  });
});

describe("productParamsSchema", () => {
  it("accepts a product public id", () => {
    const result = productParamsSchema.safeParse({
      params: { product_public_id: "prd_abc" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing product_public_id", () => {
    const result = productParamsSchema.safeParse({ params: {} });
    expect(result.success).toBe(false);
  });
});

describe("listProductsSchema", () => {
  it("applies defaults when no query is provided", () => {
    const result = listProductsSchema.safeParse({ query: {} });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.page).toBe(1);
      expect(result.data.query.limit).toBe(20);
      expect(result.data.query.sort).toBe("-created_at");
    }
  });

  it("coerces numeric query values", () => {
    const result = listProductsSchema.safeParse({
      query: { page: "2", limit: "10" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.page).toBe(2);
      expect(result.data.query.limit).toBe(10);
    }
  });

  it("accepts an allowed sort field", () => {
    const result = listProductsSchema.safeParse({ query: { sort: "name" } });
    expect(result.success).toBe(true);
  });

  it("rejects a disallowed sort field", () => {
    const result = listProductsSchema.safeParse({ query: { sort: "price" } });
    expect(result.success).toBe(false);
  });

  it("rejects a limit above 100", () => {
    const result = listProductsSchema.safeParse({ query: { limit: "101" } });
    expect(result.success).toBe(false);
  });
});

describe("listAdminProductsSchema", () => {
  it("parses include_deleted as a boolean with default false", () => {
    const defaultResult = listAdminProductsSchema.safeParse({ query: {} });
    expect(defaultResult.success).toBe(true);
    if (defaultResult.success) {
      expect(defaultResult.data.query.include_deleted).toBe(false);
    }

    const result = listAdminProductsSchema.safeParse({
      query: { include_deleted: "true" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.include_deleted).toBe(true);
    }
  });

  it("rejects a non-boolean include_deleted value", () => {
    const result = listAdminProductsSchema.safeParse({
      query: { include_deleted: "yes" },
    });
    expect(result.success).toBe(false);
  });
});

describe("getAdminProductSchema", () => {
  it("accepts an optional include_deleted_variants query", () => {
    const result = getAdminProductSchema.safeParse({
      params: { product_public_id: "prd_abc" },
      query: { include_deleted_variants: "true" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.include_deleted_variants).toBe(true);
    }
  });
});
