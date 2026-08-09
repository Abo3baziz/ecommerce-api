import { describe, it, expect, beforeEach } from "vitest";
import {
  createProductImage as createProductImageService,
  deleteProductImage as deleteProductImageService,
  getProductImage,
  listProductImages,
  updateProductImage as updateProductImageService,
} from "../../../src/modules/products/service/productImage.service.js";
import { BadRequestError } from "../../../src/shared/errors/BadRequestError.js";
import { ConflictError } from "../../../src/shared/errors/ConflictError.js";
import { NotFoundError } from "../../../src/shared/errors/NotFoundError.js";
import { prisma } from "../../../src/config/database.js";
import { createProduct } from "../../factories/product.factory.js";
import { createProductImage } from "../../factories/product-image.factory.js";
import { imageKitImageUrl } from "../../helpers/image-url.js";
import { cleanupTestData } from "../../helpers/db.js";

describe("productImage.service", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("listProductImages", () => {
    it("returns the product's images ordered by display_order", async () => {
      const product = await createProduct();
      await createProductImage(product.id, { display_order: 2 });
      await createProductImage(product.id, { display_order: 0 });
      await createProductImage(product.id, { display_order: 1 });

      const result = await listProductImages(product.public_id, 1, 20);

      expect(result.images.map((image) => image.display_order)).toEqual([0, 1, 2]);
      expect(result.pagination.total).toBe(3);
    });

    it("throws NotFoundError for an unknown product", async () => {
      await expect(listProductImages("prd_unknown", 1, 20)).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("createProductImage", () => {
    it("makes the first image primary and starts display_order at 0", async () => {
      const product = await createProduct();

      const result = await createProductImageService(product.public_id, {
        image_url: imageKitImageUrl("hero.jpg"),
      });

      expect(result.public_id).toMatch(/^pimg_/);
      expect(result.is_primary).toBe(true);
      expect(result.display_order).toBe(0);
    });

    it("auto-increments display_order when omitted", async () => {
      const product = await createProduct();
      await createProductImage(product.id, { display_order: 0 });

      const result = await createProductImageService(product.public_id, {
        image_url: imageKitImageUrl("second.jpg"),
      });

      expect(result.display_order).toBe(1);
    });

    it("demotes the previous primary when is_primary is true", async () => {
      const product = await createProduct();
      const first = await createProductImage(product.id, { is_primary: true });

      const result = await createProductImageService(product.public_id, {
        image_url: imageKitImageUrl("second.jpg"),
        is_primary: true,
      });

      expect(result.is_primary).toBe(true);
      const stored = await prisma.product_images.findFirst({
        where: { public_id: first.public_id },
      });
      expect(stored!.is_primary).toBe(false);
    });

    it("throws ConflictError for a duplicate display_order", async () => {
      const product = await createProduct();
      await createProductImage(product.id, { display_order: 3 });

      await expect(
        createProductImageService(product.public_id, {
          image_url: imageKitImageUrl("dup.jpg"),
          display_order: 3,
        }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("getProductImage", () => {
    it("returns an image belonging to the product", async () => {
      const product = await createProduct();
      const image = await createProductImage(product.id);

      const result = await getProductImage(product.public_id, image.public_id);

      expect(result.public_id).toBe(image.public_id);
    });

    it("throws NotFoundError for an image of another product", async () => {
      const product = await createProduct();
      const otherProduct = await createProduct();
      const image = await createProductImage(product.id);

      await expect(
        getProductImage(otherProduct.public_id, image.public_id),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("updateProductImage", () => {
    it("updates image fields", async () => {
      const product = await createProduct();
      const image = await createProductImage(product.id, { alt_text: "Old" });

      const updated = await updateProductImageService(product.public_id, image.public_id, {
        alt_text: "New",
        display_order: 5,
      });

      expect(updated.alt_text).toBe("New");
      expect(updated.display_order).toBe(5);
    });

    it("demotes the previous primary when promoting another image", async () => {
      const product = await createProduct();
      const primary = await createProductImage(product.id, { is_primary: true });
      const other = await createProductImage(product.id, { display_order: 1 });

      const updated = await updateProductImageService(product.public_id, other.public_id, {
        is_primary: true,
      });

      expect(updated.is_primary).toBe(true);
      const stored = await prisma.product_images.findFirst({
        where: { public_id: primary.public_id },
      });
      expect(stored!.is_primary).toBe(false);
    });

    it("rejects clearing the primary flag on the product's only image", async () => {
      const product = await createProduct();
      const image = await createProductImage(product.id, { is_primary: true });

      await expect(
        updateProductImageService(product.public_id, image.public_id, {
          is_primary: false,
        }),
      ).rejects.toThrow(BadRequestError);
    });

    it("throws ConflictError for a duplicate display_order", async () => {
      const product = await createProduct();
      const first = await createProductImage(product.id, { display_order: 0 });
      const second = await createProductImage(product.id, { display_order: 1 });

      await expect(
        updateProductImageService(product.public_id, second.public_id, {
          display_order: 0,
        }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("deleteProductImage", () => {
    it("hard-deletes the image", async () => {
      const product = await createProduct();
      const image = await createProductImage(product.id);

      await deleteProductImageService(product.public_id, image.public_id);

      const stored = await prisma.product_images.findFirst({
        where: { public_id: image.public_id },
      });
      expect(stored).toBeNull();
    });

    it("promotes the lowest-order remaining image when the primary is deleted", async () => {
      const product = await createProduct();
      const primary = await createProductImage(product.id, { display_order: 0, is_primary: true });
      const next = await createProductImage(product.id, { display_order: 1 });

      await deleteProductImageService(product.public_id, primary.public_id);

      const stored = await prisma.product_images.findFirst({
        where: { public_id: next.public_id },
      });
      expect(stored!.is_primary).toBe(true);
    });

    it("throws NotFoundError for an image of another product", async () => {
      const product = await createProduct();
      const otherProduct = await createProduct();
      const image = await createProductImage(product.id);

      await expect(
        deleteProductImageService(otherProduct.public_id, image.public_id),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
