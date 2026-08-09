import { describe, it, expect, beforeEach } from "vitest";
import {
  createVariantImage as createVariantImageService,
  deleteVariantImage as deleteVariantImageService,
  getVariantImage,
  listVariantImages,
  updateVariantImage as updateVariantImageService,
} from "../../../src/modules/products/service/variantImage.service.js";
import { ConflictError } from "../../../src/shared/errors/ConflictError.js";
import { NotFoundError } from "../../../src/shared/errors/NotFoundError.js";
import { prisma } from "../../../src/config/database.js";
import { createProduct } from "../../factories/product.factory.js";
import { createVariant } from "../../factories/variant.factory.js";
import { createVariantImage } from "../../factories/variant-image.factory.js";
import { imageKitImageUrl } from "../../helpers/image-url.js";
import { cleanupTestData } from "../../helpers/db.js";

describe("variantImage.service", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("listVariantImages", () => {
    it("returns the variant's images ordered by display_order", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);
      await createVariantImage(variant.id, { display_order: 1 });
      await createVariantImage(variant.id, { display_order: 0 });

      const result = await listVariantImages(
        product.public_id,
        variant.public_id,
        1,
        20,
      );

      expect(result.images.map((image) => image.display_order)).toEqual([0, 1]);
    });

    it("throws NotFoundError when the variant does not belong to the product", async () => {
      const product = await createProduct();
      const otherProduct = await createProduct();
      const variant = await createVariant(product.id);

      await expect(
        listVariantImages(otherProduct.public_id, variant.public_id, 1, 20),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("createVariantImage", () => {
    it("starts display_order at 0 when no order is provided", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);

      const result = await createVariantImageService(product.public_id, variant.public_id, {
        image_url: imageKitImageUrl("front.jpg"),
      });

      expect(result.public_id).toMatch(/^vimg_/);
      expect(result.display_order).toBe(0);
    });

    it("throws ConflictError for a duplicate display_order", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);
      await createVariantImage(variant.id, { display_order: 0 });

      await expect(
        createVariantImageService(product.public_id, variant.public_id, {
          image_url: imageKitImageUrl("dup.jpg"),
          display_order: 0,
        }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("getVariantImage", () => {
    it("returns an image belonging to the variant", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);
      const image = await createVariantImage(variant.id);

      const result = await getVariantImage(
        product.public_id,
        variant.public_id,
        image.public_id,
      );

      expect(result.public_id).toBe(image.public_id);
    });

    it("throws NotFoundError for an image of another variant", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);
      const otherVariant = await createVariant(product.id);
      const image = await createVariantImage(variant.id);

      await expect(
        getVariantImage(product.public_id, otherVariant.public_id, image.public_id),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("updateVariantImage", () => {
    it("updates image fields", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);
      const image = await createVariantImage(variant.id, { alt_text: "Old" });

      const updated = await updateVariantImageService(
        product.public_id,
        variant.public_id,
        image.public_id,
        { alt_text: "New", display_order: 2 },
      );

      expect(updated.alt_text).toBe("New");
      expect(updated.display_order).toBe(2);
    });

    it("throws ConflictError for a duplicate display_order", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);
      const first = await createVariantImage(variant.id, { display_order: 0 });
      const second = await createVariantImage(variant.id, { display_order: 1 });

      await expect(
        updateVariantImageService(
          product.public_id,
          variant.public_id,
          second.public_id,
          { display_order: 0 },
        ),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("deleteVariantImage", () => {
    it("hard-deletes the image", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);
      const image = await createVariantImage(variant.id);

      await deleteVariantImageService(
        product.public_id,
        variant.public_id,
        image.public_id,
      );

      const stored = await prisma.product_variant_images.findFirst({
        where: { public_id: image.public_id },
      });
      expect(stored).toBeNull();
    });
  });
});
