import { describe, it, expect, beforeEach } from "vitest";
import {
  createProduct as createProductService,
  deleteProduct as deleteProductService,
  getAdminProduct,
  getProduct,
  listAdminProducts,
  listProducts,
  updateProduct as updateProductService,
} from "../../../src/modules/products/service/product.service.js";
import { ConflictError } from "../../../src/shared/errors/ConflictError.js";
import { NotFoundError } from "../../../src/shared/errors/NotFoundError.js";
import { product_status } from "../../../src/generated/prisma/enums.js";
import { prisma } from "../../../src/config/database.js";
import { createProduct } from "../../factories/product.factory.js";
import { createVariant } from "../../factories/variant.factory.js";
import { createProductImage } from "../../factories/product-image.factory.js";
import { createVariantImage } from "../../factories/variant-image.factory.js";
import { cleanupTestData } from "../../helpers/db.js";

async function visibleProduct() {
  const product = await createProduct();
  await createVariant(product.id);
  return product;
}

describe("product.service", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("listProducts", () => {
    it("returns only customer-visible products (non-deleted with an active variant)", async () => {
      const visible = await visibleProduct();
      await createProduct();

      const result = await listProducts(1, 20, undefined, undefined, "-created_at");

      expect(result.products.map((product) => product.public_id)).toContain(
        visible.public_id,
      );
      expect(result.products).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });

    it("excludes products whose variants are not ACTIVE", async () => {
      const product = await createProduct();
      await createVariant(product.id, { status: product_status.DRAFT });

      const result = await listProducts(1, 20, undefined, undefined, "-created_at");

      expect(result.products).toHaveLength(0);
    });

    it("excludes soft-deleted products", async () => {
      const product = await createProduct({ deleted_at: new Date() });
      await createVariant(product.id);

      const result = await listProducts(1, 20, undefined, undefined, "-created_at");

      expect(result.products.map((p) => p.public_id)).not.toContain(product.public_id);
    });

    it("filters by search substring case-insensitively", async () => {
      const wireless = await createProduct({ name: "Wireless Headphones" });
      await createVariant(wireless.id);
      await visibleProduct();

      const result = await listProducts(1, 20, "WIRELESS", undefined, "-created_at");

      expect(result.products.map((p) => p.public_id)).toEqual([wireless.public_id]);
    });

    it("filters by brand case-insensitively", async () => {
      const visible = await createProduct({ brand: "SoundWave" });
      await createVariant(visible.id);
      await visibleProduct();

      const result = await listProducts(1, 20, undefined, "soundwave", "-created_at");

      expect(result.products.map((p) => p.public_id)).toEqual([visible.public_id]);
    });

    it("sorts by name ascending", async () => {
      const a = await createProduct({ name: "Alpha Headphones" });
      await createVariant(a.id);
      const b = await createProduct({ name: "Beta Headphones" });
      await createVariant(b.id);

      const result = await listProducts(1, 20, undefined, undefined, "name");

      expect(result.products.map((p) => p.public_id)).toEqual([
        a.public_id,
        b.public_id,
      ]);
    });

    it("reports pagination metadata", async () => {
      for (let index = 0; index < 3; index += 1) {
        await visibleProduct();
      }

      const result = await listProducts(2, 2, undefined, undefined, "-created_at");

      expect(result.products).toHaveLength(1);
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

  describe("getProduct", () => {
    it("returns the customer detail with active variants and images", async () => {
      const product = await createProduct({
        name: "Wireless Headphones",
        brand: "SoundWave",
      });
      const variant = await createVariant(product.id, {
        sku: "SW-HP-001",
        price: "129.99",
        discount_percentage: "10.00",
        weight: "0.25",
      });
      await createVariantImage(variant.id, { display_order: 1 });
      await createProductImage(product.id, { display_order: 0, is_primary: true });

      const result = await getProduct(product.public_id);

      expect(result.public_id).toBe(product.public_id);
      expect(result.variants).toHaveLength(1);
      const customerVariant = result.variants[0];
      expect(customerVariant.public_id).toBe(variant.public_id);
      expect(customerVariant.price).toBe("129.99");
      expect(customerVariant.final_price).toBe("116.99");
      expect(customerVariant.images).toHaveLength(1);
      expect(customerVariant).not.toHaveProperty("cost_price");
      expect(customerVariant).not.toHaveProperty("status");
      expect(customerVariant).not.toHaveProperty("barcode");
      expect(result.images).toHaveLength(1);
      expect(result.images[0].is_primary).toBe(true);
    });

    it("excludes non-ACTIVE variants from the customer detail", async () => {
      const product = await createProduct();
      await createVariant(product.id, { status: product_status.ACTIVE });
      await createVariant(product.id, { status: product_status.DRAFT });

      const result = await getProduct(product.public_id);

      expect(result.variants).toHaveLength(1);
      expect(result.variants[0].sku).not.toBeNull();
    });

    it("throws NotFoundError for a soft-deleted product", async () => {
      const product = await createProduct({ deleted_at: new Date() });
      await createVariant(product.id);

      await expect(getProduct(product.public_id)).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError when the product has no active variant", async () => {
      const product = await createProduct();
      await createVariant(product.id, { status: product_status.INACTIVE });

      await expect(getProduct(product.public_id)).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for an unknown product", async () => {
      await expect(getProduct("prd_unknown")).rejects.toThrow(NotFoundError);
    });
  });

  describe("listAdminProducts", () => {
    it("excludes soft-deleted products by default", async () => {
      await visibleProduct();
      const deleted = await createProduct({ deleted_at: new Date() });
      await createVariant(deleted.id);

      const result = await listAdminProducts(1, 20, undefined, undefined, false, "-created_at");

      expect(result.products.map((p) => p.public_id)).not.toContain(deleted.public_id);
      expect(result.pagination.total).toBe(1);
    });

    it("includes soft-deleted products when include_deleted is true", async () => {
      const deleted = await createProduct({ deleted_at: new Date() });
      await createVariant(deleted.id);

      const result = await listAdminProducts(1, 20, undefined, undefined, true, "-created_at");

      expect(result.products.map((p) => p.public_id)).toContain(deleted.public_id);
      expect(result.products[0]).not.toHaveProperty("deleted_at");
    });
  });

  describe("createProduct", () => {
    it("auto-generates a slug from the name", async () => {
      const result = await createProductService({
        name: "Wireless Noise-Cancelling Headphones",
      });

      expect(result.public_id).toMatch(/^prd_/);
      expect(result.slug).toBe("wireless-noise-cancelling-headphones");
    });

    it("uses the provided slug", async () => {
      const result = await createProductService({
        name: "Headphones",
        slug: "custom-slug",
      });

      expect(result.slug).toBe("custom-slug");
    });

    it("appends a numeric suffix when the generated slug conflicts", async () => {
      await createProduct({ name: "Test Product", slug: "test-product" });

      const result = await createProductService({ name: "Test Product" });

      expect(result.slug).toBe("test-product-2");
    });

    it("throws ConflictError for an existing explicit slug", async () => {
      await createProduct({ name: "Existing", slug: "existing-slug" });

      await expect(
        createProductService({ name: "New", slug: "existing-slug" }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("getAdminProduct", () => {
    it("returns the full admin detail with variants and images", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id, {
        cost_price: "85.00",
        barcode: "4006381333931",
      });
      await createProductImage(product.id, { is_primary: true });

      const result = await getAdminProduct(product.public_id, false);

      expect(result.public_id).toBe(product.public_id);
      expect(result.variants[0].public_id).toBe(variant.public_id);
      expect(result.variants[0].cost_price).toBe("85.00");
      expect(result.variants[0].barcode).toBe("4006381333931");
      expect(result.variants[0].status).toBe(product_status.ACTIVE);
      expect(result.images[0].is_primary).toBe(true);
    });

    it("excludes soft-deleted variants by default and includes them when requested", async () => {
      const product = await createProduct();
      const active = await createVariant(product.id);
      const deleted = await createVariant(product.id, { deleted_at: new Date() });

      const withoutDeleted = await getAdminProduct(product.public_id, false);
      expect(withoutDeleted.variants.map((v) => v.public_id)).toEqual([
        active.public_id,
      ]);

      const withDeleted = await getAdminProduct(product.public_id, true);
      expect(withDeleted.variants.map((v) => v.public_id)).toEqual(
        expect.arrayContaining([deleted.public_id]),
      );
    });

    it("throws NotFoundError for a soft-deleted product", async () => {
      const product = await createProduct({ deleted_at: new Date() });
      await createVariant(product.id);

      await expect(getAdminProduct(product.public_id, false)).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("updateProduct", () => {
    it("updates only the provided fields", async () => {
      const product = await createProduct();

      const updated = await updateProductService(product.public_id, {
        name: "Renamed Product",
      });

      expect(updated.name).toBe("Renamed Product");
      expect(updated.slug).toBe(product.slug);
    });

    it("clears description and brand with null", async () => {
      const product = await createProduct({
        description: "Some description",
        brand: "SomeBrand",
      });

      const updated = await updateProductService(product.public_id, {
        description: null,
        brand: null,
      });

      expect(updated.description).toBeNull();
      expect(updated.brand).toBeNull();
    });

    it("throws ConflictError when setting an existing slug", async () => {
      const first = await createProduct({ name: "First", slug: "first-slug" });
      const second = await createProduct({ name: "Second", slug: "second-slug" });

      await expect(
        updateProductService(second.public_id, { slug: "first-slug" }),
      ).rejects.toThrow(ConflictError);
    });

    it("throws NotFoundError for a soft-deleted product", async () => {
      const product = await createProduct({ deleted_at: new Date() });

      await expect(
        updateProductService(product.public_id, { name: "Nope" }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("deleteProduct", () => {
    it("soft-deletes the product and all of its variants in one transaction", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);

      await deleteProductService(product.public_id);

      const storedProduct = await prisma.products.findFirst({
        where: { public_id: product.public_id },
      });
      expect(storedProduct!.deleted_at).not.toBeNull();

      const storedVariant = await prisma.product_variants.findFirst({
        where: { public_id: variant.public_id },
      });
      expect(storedVariant!.deleted_at).not.toBeNull();
    });

    it("throws NotFoundError for an already soft-deleted product", async () => {
      const product = await createProduct({ deleted_at: new Date() });
      await createVariant(product.id);

      await expect(deleteProductService(product.public_id)).rejects.toThrow(
        NotFoundError,
      );
    });
  });
});
