import { describe, it, expect, beforeEach } from "vitest";
import {
  assignProductToCategory,
  createCategory as createCategoryService,
  deleteCategory as deleteCategoryService,
  getAdminCategory,
  getCategory,
  listAdminCategories,
  listCategories,
  listCategoryProducts,
  unassignProductFromCategory,
  updateCategory as updateCategoryService,
} from "../../../src/modules/categories/service/category.service.js";
import { ConflictError } from "../../../src/shared/errors/ConflictError.js";
import { NotFoundError } from "../../../src/shared/errors/NotFoundError.js";
import { product_status } from "../../../src/generated/prisma/enums.js";
import { prisma } from "../../../src/config/database.js";
import { createCategory } from "../../factories/category.factory.js";
import { createCategoryProductLink } from "../../factories/category-product.factory.js";
import { createProduct } from "../../factories/product.factory.js";
import { createVariant } from "../../factories/variant.factory.js";
import { cleanupTestData } from "../../helpers/db.js";

async function visibleProduct() {
  const product = await createProduct();
  await createVariant(product.id);
  return product;
}

describe("category.service", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("listCategories", () => {
    it("returns only active, non-deleted categories", async () => {
      await createCategory({ name: "Active Category" });
      await createCategory({ name: "Inactive Category", is_active: false });
      await createCategory({ name: "Deleted Category", deleted_at: new Date() });

      const result = await listCategories(1, 20, undefined, "name");

      expect(result.categories.map((category) => category.name)).toEqual([
        "Active Category",
      ]);
      expect(result.pagination.total).toBe(1);
    });

    it("does not expose is_active or internal ids", async () => {
      await createCategory({ name: "Headphones" });

      const result = await listCategories(1, 20, undefined, "name");

      expect(result.categories[0]).not.toHaveProperty("is_active");
      expect(result.categories[0]).not.toHaveProperty("id");
      expect(result.categories[0]).not.toHaveProperty("deleted_at");
    });

    it("filters by search substring case-insensitively on name and slug", async () => {
      await createCategory({ name: "Wireless Headphones", slug: "wireless-headphones" });
      await createCategory({ name: "Speakers", slug: "speakers" });

      const byName = await listCategories(1, 20, "WIRELESS", "name");
      expect(byName.categories.map((category) => category.name)).toEqual([
        "Wireless Headphones",
      ]);

      const bySlug = await listCategories(1, 20, "speak", "name");
      expect(bySlug.categories.map((category) => category.name)).toEqual([
        "Speakers",
      ]);
    });

    it("sorts by name ascending by default", async () => {
      const alpha = await createCategory({ name: "Alpha" });
      const beta = await createCategory({ name: "Beta" });

      const result = await listCategories(1, 20, undefined, "name");

      expect(result.categories.map((category) => category.public_id)).toEqual([
        alpha.public_id,
        beta.public_id,
      ]);
    });

    it("sorts by created_at descending", async () => {
      const first = await createCategory({ name: "First" });
      const second = await createCategory({ name: "Second" });

      const result = await listCategories(1, 20, undefined, "-created_at");

      expect(result.categories.map((category) => category.public_id)).toEqual([
        second.public_id,
        first.public_id,
      ]);
    });

    it("reports pagination metadata", async () => {
      for (let index = 0; index < 3; index += 1) {
        await createCategory({ name: `Category ${index}` });
      }

      const result = await listCategories(2, 2, undefined, "name");

      expect(result.categories).toHaveLength(1);
      expect(result.pagination).toEqual({
        page: 2,
        limit: 2,
        total: 3,
        totalPages: 2,
        hasNext: false,
        hasPrev: true,
      });
    });
  });

  describe("getCategory", () => {
    it("returns the customer detail with a product_count of customer-visible products", async () => {
      const category = await createCategory({ name: "Headphones" });
      const visible = await visibleProduct();
      const noVariant = await createProduct({ name: "Variantless" });
      await createCategoryProductLink(category.id, visible.id);
      await createCategoryProductLink(category.id, noVariant.id);

      const result = await getCategory(category.public_id);

      expect(result.public_id).toBe(category.public_id);
      expect(result.product_count).toBe(1);
      expect(result).not.toHaveProperty("is_active");
    });

    it("counts only products with an ACTIVE variant", async () => {
      const category = await createCategory({ name: "Headphones" });
      const product = await createProduct();
      await createVariant(product.id, { status: product_status.DRAFT });
      await createCategoryProductLink(category.id, product.id);

      const result = await getCategory(category.public_id);

      expect(result.product_count).toBe(0);
    });

    it("throws NotFoundError for an inactive category", async () => {
      const category = await createCategory({ is_active: false });

      await expect(getCategory(category.public_id)).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for a soft-deleted category", async () => {
      const category = await createCategory({ deleted_at: new Date() });

      await expect(getCategory(category.public_id)).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for an unknown category", async () => {
      await expect(getCategory("cat_unknown")).rejects.toThrow(NotFoundError);
    });
  });

  describe("listCategoryProducts", () => {
    it("returns only customer-visible products linked to the category", async () => {
      const category = await createCategory({ name: "Headphones" });
      const visible = await visibleProduct();
      const other = await visibleProduct();
      await createCategoryProductLink(category.id, visible.id);
      await createCategoryProductLink(category.id, other.id);
      await createProduct({ name: "Unlinked Product" });

      const result = await listCategoryProducts(
        category.public_id,
        1,
        20,
        undefined,
        "-created_at",
      );

      expect(result.products.map((product) => product.public_id)).toEqual(
        expect.arrayContaining([visible.public_id, other.public_id]),
      );
      expect(result.products).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it("excludes products without an active variant and soft-deleted products", async () => {
      const category = await createCategory({ name: "Headphones" });
      const visible = await visibleProduct();
      const variantless = await createProduct({ name: "Variantless" });
      const deleted = await createProduct({ deleted_at: new Date() });
      await createVariant(deleted.id);
      await createCategoryProductLink(category.id, visible.id);
      await createCategoryProductLink(category.id, variantless.id);
      await createCategoryProductLink(category.id, deleted.id);

      const result = await listCategoryProducts(
        category.public_id,
        1,
        20,
        undefined,
        "-created_at",
      );

      expect(result.products.map((product) => product.public_id)).toEqual([
        visible.public_id,
      ]);
    });

    it("filters by search across name, brand, and description", async () => {
      const category = await createCategory({ name: "Headphones" });
      const matching = await createProduct({ name: "Wireless Headphones", brand: "SoundWave" });
      await createVariant(matching.id);
      const other = await visibleProduct();
      await createCategoryProductLink(category.id, matching.id);
      await createCategoryProductLink(category.id, other.id);

      const result = await listCategoryProducts(
        category.public_id,
        1,
        20,
        "SOUNDWAVE",
        "-created_at",
      );

      expect(result.products.map((product) => product.public_id)).toEqual([
        matching.public_id,
      ]);
    });

    it("throws NotFoundError when the category is inactive or deleted", async () => {
      const inactive = await createCategory({ is_active: false });
      const deleted = await createCategory({ deleted_at: new Date() });

      await expect(
        listCategoryProducts(inactive.public_id, 1, 20, undefined, "-created_at"),
      ).rejects.toThrow(NotFoundError);
      await expect(
        listCategoryProducts(deleted.public_id, 1, 20, undefined, "-created_at"),
      ).rejects.toThrow(NotFoundError);
    });

    it("does not expose internal ids in the product payloads", async () => {
      const category = await createCategory({ name: "Headphones" });
      const product = await visibleProduct();
      await createCategoryProductLink(category.id, product.id);

      const result = await listCategoryProducts(
        category.public_id,
        1,
        20,
        undefined,
        "-created_at",
      );

      expect(result.products[0]).not.toHaveProperty("id");
      expect(result.products[0]).not.toHaveProperty("deleted_at");
    });
  });

  describe("listAdminCategories", () => {
    it("excludes soft-deleted categories by default and includes them when requested", async () => {
      await createCategory({ name: "Active" });
      const deleted = await createCategory({ name: "Deleted", deleted_at: new Date() });

      const withoutDeleted = await listAdminCategories(1, 20, undefined, undefined, false, "name");
      expect(withoutDeleted.categories.map((category) => category.public_id)).not.toContain(
        deleted.public_id,
      );

      const withDeleted = await listAdminCategories(1, 20, undefined, undefined, true, "name");
      expect(withDeleted.categories.map((category) => category.public_id)).toContain(
        deleted.public_id,
      );
      expect(withDeleted.categories[0]).not.toHaveProperty("deleted_at");
    });

    it("filters by is_active", async () => {
      await createCategory({ name: "Active" });
      await createCategory({ name: "Inactive", is_active: false });

      const inactive = await listAdminCategories(1, 20, undefined, false, false, "name");
      expect(inactive.categories.map((category) => category.name)).toEqual(["Inactive"]);

      const all = await listAdminCategories(1, 20, undefined, undefined, false, "name");
      expect(all.pagination.total).toBe(2);
    });

    it("includes is_active in admin payloads", async () => {
      await createCategory({ name: "Headphones" });

      const result = await listAdminCategories(1, 20, undefined, undefined, false, "name");

      expect(result.categories[0]).toHaveProperty("is_active", true);
    });
  });

  describe("createCategory", () => {
    it("auto-generates a slug from the name and defaults is_active to true", async () => {
      const result = await createCategoryService({
        name: "Wireless Noise-Cancelling Headphones",
      });

      expect(result.public_id).toMatch(/^cat_/);
      expect(result.slug).toBe("wireless-noise-cancelling-headphones");
      expect(result.is_active).toBe(true);
    });

    it("uses the provided slug", async () => {
      const result = await createCategoryService({
        name: "Headphones",
        slug: "custom-slug",
      });

      expect(result.slug).toBe("custom-slug");
    });

    it("appends a numeric suffix when the generated slug conflicts", async () => {
      await createCategory({ name: "Other Category", slug: "test-category" });

      const result = await createCategoryService({ name: "Test Category" });

      expect(result.slug).toBe("test-category-2");
    });

    it("throws ConflictError for an existing explicit slug", async () => {
      await createCategory({ name: "Existing", slug: "existing-slug" });

      await expect(
        createCategoryService({ name: "New", slug: "existing-slug" }),
      ).rejects.toThrow(ConflictError);
    });

    it("throws ConflictError for an existing name", async () => {
      await createCategory({ name: "Headphones" });

      await expect(
        createCategoryService({ name: "Headphones" }),
      ).rejects.toThrow(ConflictError);
    });

    it("creates an inactive category when requested", async () => {
      const result = await createCategoryService({
        name: "Hidden Category",
        is_active: false,
      });

      expect(result.is_active).toBe(false);
    });
  });

  describe("getAdminCategory", () => {
    it("returns is_active and the non-deleted product count", async () => {
      const category = await createCategory({ name: "Headphones" });
      const product = await visibleProduct();
      await createCategoryProductLink(category.id, product.id);

      const result = await getAdminCategory(category.public_id);

      expect(result.is_active).toBe(true);
      expect(result.product_count).toBe(1);
    });

    it("counts products regardless of variant availability", async () => {
      const category = await createCategory({ name: "Headphones" });
      const variantless = await createProduct({ name: "Variantless" });
      await createCategoryProductLink(category.id, variantless.id);

      const result = await getAdminCategory(category.public_id);

      expect(result.product_count).toBe(1);
    });

    it("throws NotFoundError for a soft-deleted category", async () => {
      const category = await createCategory({ deleted_at: new Date() });

      await expect(getAdminCategory(category.public_id)).rejects.toThrow(NotFoundError);
    });
  });

  describe("updateCategory", () => {
    it("updates only the provided fields", async () => {
      const category = await createCategory({ name: "Original Name" });

      const updated = await updateCategoryService(category.public_id, {
        name: "Renamed Category",
      });

      expect(updated.name).toBe("Renamed Category");
      expect(updated.slug).toBe(category.slug);
    });

    it("clears description with null", async () => {
      const category = await createCategory({ description: "Some description" });

      const updated = await updateCategoryService(category.public_id, {
        description: null,
      });

      expect(updated.description).toBeNull();
    });

    it("toggles is_active", async () => {
      const category = await createCategory({ is_active: true });

      const updated = await updateCategoryService(category.public_id, {
        is_active: false,
      });

      expect(updated.is_active).toBe(false);
    });

    it("throws ConflictError when setting an existing name", async () => {
      await createCategory({ name: "Existing Name" });
      const category = await createCategory({ name: "My Category" });

      await expect(
        updateCategoryService(category.public_id, { name: "Existing Name" }),
      ).rejects.toThrow(ConflictError);
    });

    it("throws ConflictError when setting an existing slug", async () => {
      await createCategory({ name: "Existing", slug: "existing-slug" });
      const category = await createCategory({ name: "My Category", slug: "my-slug" });

      await expect(
        updateCategoryService(category.public_id, { slug: "existing-slug" }),
      ).rejects.toThrow(ConflictError);
    });

    it("allows keeping the same name and slug", async () => {
      const category = await createCategory({ name: "Keep Me", slug: "keep-me" });

      const updated = await updateCategoryService(category.public_id, {
        name: "Keep Me",
        slug: "keep-me",
      });

      expect(updated.name).toBe("Keep Me");
      expect(updated.slug).toBe("keep-me");
    });

    it("throws NotFoundError for a soft-deleted category", async () => {
      const category = await createCategory({ deleted_at: new Date() });

      await expect(
        updateCategoryService(category.public_id, { name: "Nope" }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("deleteCategory", () => {
    it("soft-deletes the category and removes its links in one transaction", async () => {
      const category = await createCategory({ name: "Headphones" });
      const product = await visibleProduct();
      await createCategoryProductLink(category.id, product.id);

      await deleteCategoryService(category.public_id);

      const storedCategory = await prisma.categories.findFirst({
        where: { public_id: category.public_id },
      });
      expect(storedCategory!.deleted_at).not.toBeNull();

      const links = await prisma.product_categories.findMany({
        where: { categories_id: category.id },
      });
      expect(links).toHaveLength(0);

      const storedProduct = await prisma.products.findFirst({
        where: { public_id: product.public_id },
      });
      expect(storedProduct!.deleted_at).toBeNull();
    });

    it("throws NotFoundError for an already soft-deleted category", async () => {
      const category = await createCategory({ deleted_at: new Date() });

      await expect(deleteCategoryService(category.public_id)).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("assignProductToCategory", () => {
    it("creates a link between the category and the product", async () => {
      const category = await createCategory({ name: "Headphones" });
      const product = await createProduct();

      await assignProductToCategory(category.public_id, product.public_id);

      const link = await prisma.product_categories.findFirst({
        where: { categories_id: category.id, products_id: product.id },
      });
      expect(link).not.toBeNull();
    });

    it("is idempotent when the product is already assigned", async () => {
      const category = await createCategory({ name: "Headphones" });
      const product = await createProduct();
      await assignProductToCategory(category.public_id, product.public_id);

      await assignProductToCategory(category.public_id, product.public_id);

      const links = await prisma.product_categories.findMany({
        where: { categories_id: category.id, products_id: product.id },
      });
      expect(links).toHaveLength(1);
    });

    it("throws NotFoundError for a missing category", async () => {
      const product = await createProduct();

      await expect(
        assignProductToCategory("cat_unknown", product.public_id),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for a soft-deleted category", async () => {
      const category = await createCategory({ deleted_at: new Date() });
      const product = await createProduct();

      await expect(
        assignProductToCategory(category.public_id, product.public_id),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for a missing or soft-deleted product", async () => {
      const category = await createCategory({ name: "Headphones" });
      const deleted = await createProduct({ deleted_at: new Date() });

      await expect(
        assignProductToCategory(category.public_id, "prd_unknown"),
      ).rejects.toThrow(NotFoundError);
      await expect(
        assignProductToCategory(category.public_id, deleted.public_id),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("unassignProductFromCategory", () => {
    it("removes the link between the category and the product", async () => {
      const category = await createCategory({ name: "Headphones" });
      const product = await createProduct();
      await createCategoryProductLink(category.id, product.id);

      await unassignProductFromCategory(category.public_id, product.public_id);

      const links = await prisma.product_categories.findMany({
        where: { categories_id: category.id, products_id: product.id },
      });
      expect(links).toHaveLength(0);
    });

    it("is idempotent when the link does not exist", async () => {
      const category = await createCategory({ name: "Headphones" });
      const product = await createProduct();

      await unassignProductFromCategory(category.public_id, product.public_id);

      const links = await prisma.product_categories.findMany({
        where: { categories_id: category.id, products_id: product.id },
      });
      expect(links).toHaveLength(0);
    });

    it("throws NotFoundError for a missing category or product", async () => {
      const category = await createCategory({ name: "Headphones" });
      const product = await createProduct();

      await expect(
        unassignProductFromCategory("cat_unknown", product.public_id),
      ).rejects.toThrow(NotFoundError);
      await expect(
        unassignProductFromCategory(category.public_id, "prd_unknown"),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
