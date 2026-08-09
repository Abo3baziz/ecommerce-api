import { describe, it, expect, beforeEach } from "vitest";
import {
  createVariant as createVariantService,
  deleteVariant as deleteVariantService,
  getVariant,
  listVariants,
  updateVariant as updateVariantService,
} from "../../../src/modules/products/service/variant.service.js";
import { ConflictError } from "../../../src/shared/errors/ConflictError.js";
import { NotFoundError } from "../../../src/shared/errors/NotFoundError.js";
import { product_status } from "../../../src/generated/prisma/enums.js";
import { prisma } from "../../../src/config/database.js";
import { createProduct } from "../../factories/product.factory.js";
import { createVariant } from "../../factories/variant.factory.js";
import { createVariantImage } from "../../factories/variant-image.factory.js";
import { cleanupTestData } from "../../helpers/db.js";

function variantPayload(overrides: Record<string, unknown> = {}) {
  return {
    sku: `SW-HP-${Math.floor(Math.random() * 1000000)}`,
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
    ...overrides,
  };
}

describe("variant.service", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("listVariants", () => {
    it("returns the product's variants with pagination metadata", async () => {
      const product = await createProduct();
      for (let index = 0; index < 3; index += 1) {
        await createVariant(product.id);
      }

      const result = await listVariants(product.public_id, 2, 2, undefined, false, "created_at");

      expect(result.variants).toHaveLength(1);
      expect(result.pagination).toEqual({
        page: 2,
        limit: 2,
        total: 3,
        totalPages: 2,
        hasNext: false,
        hasPrev: true,
      });
    });

    it("excludes soft-deleted variants unless include_deleted is true", async () => {
      const product = await createProduct();
      const active = await createVariant(product.id);
      const deleted = await createVariant(product.id, { deleted_at: new Date() });

      const withoutDeleted = await listVariants(product.public_id, 1, 20, undefined, false, "created_at");
      expect(withoutDeleted.variants.map((v) => v.public_id)).toEqual([active.public_id]);

      const withDeleted = await listVariants(product.public_id, 1, 20, undefined, true, "created_at");
      expect(withDeleted.variants.map((v) => v.public_id)).toEqual(
        expect.arrayContaining([deleted.public_id]),
      );
    });

    it("filters by status", async () => {
      const product = await createProduct();
      await createVariant(product.id, { status: product_status.ACTIVE });
      await createVariant(product.id, { status: product_status.DRAFT });

      const result = await listVariants(product.public_id, 1, 20, product_status.DRAFT, false, "created_at");

      expect(result.variants).toHaveLength(1);
      expect(result.variants[0].status).toBe(product_status.DRAFT);
    });

    it("throws NotFoundError when the parent product is missing", async () => {
      await expect(
        listVariants("prd_unknown", 1, 20, undefined, false, "created_at"),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("createVariant", () => {
    it("creates a variant with ACTIVE status and 0 discount by default", async () => {
      const product = await createProduct();

      const result = await createVariantService(product.public_id, {
        sku: "SW-HP-001",
        price: "99.99",
      });

      expect(result.public_id).toMatch(/^var_/);
      expect(result.status).toBe(product_status.ACTIVE);
      expect(result.discount_percentage).toBe("0.00");
      expect(result.price).toBe("99.99");
    });

    it("persists the full payload", async () => {
      const product = await createProduct();

      const result = await createVariantService(product.public_id, variantPayload());

      expect(result.sku).toBeDefined();
      expect(result.color).toBe("Black");
      expect(result.cost_price).toBe("85.00");
    });

    it("throws ConflictError for a duplicate SKU", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);

      await expect(
        createVariantService(product.public_id, {
          sku: variant.sku,
          price: "99.99",
        }),
      ).rejects.toThrow(ConflictError);
    });

    it("throws NotFoundError when the parent product is soft-deleted", async () => {
      const product = await createProduct({ deleted_at: new Date() });

      await expect(
        createVariantService(product.public_id, { sku: "SKU-1", price: "10.00" }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("getVariant", () => {
    it("returns a variant with its images ordered by display_order", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);
      await createVariantImage(variant.id, { display_order: 2 });
      await createVariantImage(variant.id, { display_order: 1 });

      const result = await getVariant(product.public_id, variant.public_id);

      expect(result.public_id).toBe(variant.public_id);
      expect(result.images.map((image) => image.display_order)).toEqual([1, 2]);
    });

    it("throws NotFoundError for a variant belonging to another product", async () => {
      const product = await createProduct();
      const otherProduct = await createProduct();
      const variant = await createVariant(product.id);

      await expect(
        getVariant(otherProduct.public_id, variant.public_id),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for a soft-deleted variant", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id, { deleted_at: new Date() });

      await expect(
        getVariant(product.public_id, variant.public_id),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("updateVariant", () => {
    it("updates only the provided fields", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);

      const updated = await updateVariantService(product.public_id, variant.public_id, {
        price: "119.99",
      });

      expect(updated.price).toBe("119.99");
      expect(updated.sku).toBe(variant.sku);
    });

    it("clears nullable fields with null", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id, { barcode: "123" });

      const updated = await updateVariantService(product.public_id, variant.public_id, {
        barcode: null,
        status: null,
      });

      expect(updated.barcode).toBeNull();
      expect(updated.status).toBeNull();
    });

    it("throws ConflictError when setting an existing SKU", async () => {
      const product = await createProduct();
      const first = await createVariant(product.id);
      const second = await createVariant(product.id);

      await expect(
        updateVariantService(product.public_id, second.public_id, { sku: first.sku }),
      ).rejects.toThrow(ConflictError);
    });

    it("throws NotFoundError for a soft-deleted variant", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id, { deleted_at: new Date() });

      await expect(
        updateVariantService(product.public_id, variant.public_id, { price: "10.00" }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("deleteVariant", () => {
    it("soft-deletes the variant", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);

      await deleteVariantService(product.public_id, variant.public_id);

      const stored = await prisma.product_variants.findFirst({
        where: { public_id: variant.public_id },
      });
      expect(stored!.deleted_at).not.toBeNull();
    });

    it("throws NotFoundError for an already soft-deleted variant", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id, { deleted_at: new Date() });

      await expect(
        deleteVariantService(product.public_id, variant.public_id),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError when the variant does not belong to the product", async () => {
      const product = await createProduct();
      const otherProduct = await createProduct();
      const variant = await createVariant(product.id);

      await expect(
        deleteVariantService(otherProduct.public_id, variant.public_id),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
