import { describe, it, expect } from "vitest";
import {
  createCategorySchema,
  updateCategorySchema,
  categoryParamsSchema,
  categoryProductParamsSchema,
  listCategoriesSchema,
  listAdminCategoriesSchema,
  listCategoryProductsSchema,
} from "../../../src/modules/categories/validators/category.js";

const validBody = {
  name: "Headphones",
  slug: "headphones",
  description: "Wired and wireless headphones, earbuds, and headsets.",
  is_active: true,
};

describe("createCategorySchema", () => {
  it("accepts a valid payload", () => {
    const result = createCategorySchema.safeParse({ body: validBody });
    expect(result.success).toBe(true);
  });

  it("accepts a minimal payload without optional fields", () => {
    const result = createCategorySchema.safeParse({
      body: { name: "Headphones" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing name", () => {
    const { name, ...body } = validBody;
    const result = createCategorySchema.safeParse({ body });
    expect(result.success).toBe(false);
  });

  it("rejects a blank name", () => {
    const result = createCategorySchema.safeParse({
      body: { ...validBody, name: "   " },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed slug", () => {
    const result = createCategorySchema.safeParse({
      body: { ...validBody, slug: "Invalid Slug!" },
    });
    expect(result.success).toBe(false);
  });
});

describe("updateCategorySchema", () => {
  it("accepts a partial payload", () => {
    const result = updateCategorySchema.safeParse({
      params: { category_public_id: "cat_abc" },
      body: { name: "New Name" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts null to clear description", () => {
    const result = updateCategorySchema.safeParse({
      params: { category_public_id: "cat_abc" },
      body: { description: null },
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty body", () => {
    const result = updateCategorySchema.safeParse({
      params: { category_public_id: "cat_abc" },
      body: {},
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing category_public_id param", () => {
    const result = updateCategorySchema.safeParse({
      params: {},
      body: { name: "New Name" },
    });
    expect(result.success).toBe(false);
  });
});

describe("categoryParamsSchema", () => {
  it("accepts a category public id", () => {
    const result = categoryParamsSchema.safeParse({
      params: { category_public_id: "cat_abc" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing category_public_id", () => {
    const result = categoryParamsSchema.safeParse({ params: {} });
    expect(result.success).toBe(false);
  });
});

describe("categoryProductParamsSchema", () => {
  it("accepts both public ids", () => {
    const result = categoryProductParamsSchema.safeParse({
      params: { category_public_id: "cat_abc", product_public_id: "prd_abc" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing product_public_id", () => {
    const result = categoryProductParamsSchema.safeParse({
      params: { category_public_id: "cat_abc" },
    });
    expect(result.success).toBe(false);
  });
});

describe("listCategoriesSchema", () => {
  it("applies defaults when no query is provided", () => {
    const result = listCategoriesSchema.safeParse({ query: {} });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.page).toBe(1);
      expect(result.data.query.limit).toBe(20);
      expect(result.data.query.sort).toBe("name");
    }
  });

  it("coerces numeric query values", () => {
    const result = listCategoriesSchema.safeParse({
      query: { page: "2", limit: "10" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.page).toBe(2);
      expect(result.data.query.limit).toBe(10);
    }
  });

  it("accepts an allowed sort field", () => {
    const result = listCategoriesSchema.safeParse({ query: { sort: "updated_at" } });
    expect(result.success).toBe(true);
  });

  it("rejects a disallowed sort field", () => {
    const result = listCategoriesSchema.safeParse({ query: { sort: "price" } });
    expect(result.success).toBe(false);
  });

  it("rejects a limit above 100", () => {
    const result = listCategoriesSchema.safeParse({ query: { limit: "101" } });
    expect(result.success).toBe(false);
  });
});

describe("listAdminCategoriesSchema", () => {
  it("parses include_deleted as a boolean with default false", () => {
    const defaultResult = listAdminCategoriesSchema.safeParse({ query: {} });
    expect(defaultResult.success).toBe(true);
    if (defaultResult.success) {
      expect(defaultResult.data.query.include_deleted).toBe(false);
    }

    const result = listAdminCategoriesSchema.safeParse({
      query: { include_deleted: "true" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.include_deleted).toBe(true);
    }
  });

  it("parses is_active as an optional boolean", () => {
    const omitted = listAdminCategoriesSchema.safeParse({ query: {} });
    expect(omitted.success).toBe(true);
    if (omitted.success) {
      expect(omitted.data.query.is_active).toBeUndefined();
    }

    const active = listAdminCategoriesSchema.safeParse({
      query: { is_active: "false" },
    });
    expect(active.success).toBe(true);
    if (active.success) {
      expect(active.data.query.is_active).toBe(false);
    }
  });

  it("rejects a non-boolean is_active value", () => {
    const result = listAdminCategoriesSchema.safeParse({
      query: { is_active: "yes" },
    });
    expect(result.success).toBe(false);
  });
});

describe("listCategoryProductsSchema", () => {
  it("applies defaults including the created_at descending sort", () => {
    const result = listCategoryProductsSchema.safeParse({
      params: { category_public_id: "cat_abc" },
      query: {},
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.page).toBe(1);
      expect(result.data.query.limit).toBe(20);
      expect(result.data.query.sort).toBe("-created_at");
    }
  });

  it("rejects a missing category_public_id", () => {
    const result = listCategoryProductsSchema.safeParse({ query: {} });
    expect(result.success).toBe(false);
  });

  it("rejects a disallowed sort field", () => {
    const result = listCategoryProductsSchema.safeParse({
      params: { category_public_id: "cat_abc" },
      query: { sort: "price" },
    });
    expect(result.success).toBe(false);
  });
});
