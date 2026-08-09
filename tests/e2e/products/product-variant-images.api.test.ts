import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { nanoid } from "nanoid";
import { app } from "../../../src/app/index.js";
import { createAdminUser, registerUser } from "../../helpers/auth.js";
import { cleanupTestData } from "../../helpers/db.js";
import { imageKitImageUrl } from "../../helpers/image-url.js";
import { createProduct } from "../../factories/product.factory.js";
import { createVariant } from "../../factories/variant.factory.js";
import { createVariantImage } from "../../factories/variant-image.factory.js";

function variantImagePayload(overrides: Record<string, unknown> = {}) {
  return {
    image_url: imageKitImageUrl(),
    alt_text: "Variant side view",
    ...overrides,
  };
}

describe("product variant images API", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("authentication and authorization", () => {
    it("returns 401 without a session", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);

      const response = await request(app).get(
        `/api/v1/admin/products/${product.public_id}/variants/${variant.public_id}/images`,
      );

      expect(response.status).toBe(401);
    });

    it("returns 403 for a non-admin session", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);
      const { cookie } = await registerUser(app);

      const response = await request(app)
        .get(
          `/api/v1/admin/products/${product.public_id}/variants/${variant.public_id}/images`,
        )
        .set("Cookie", cookie!);

      expect(response.status).toBe(403);
    });
  });

  describe("GET /api/v1/admin/products/:product_public_id/variants/:variant_public_id/images", () => {
    it("lists the variant's images ordered by display_order (200)", async () => {
      const { cookie } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);
      const first = await createVariantImage(variant.id, { display_order: 1 });
      const second = await createVariantImage(variant.id, { display_order: 0 });

      const response = await request(app)
        .get(
          `/api/v1/admin/products/${product.public_id}/variants/${variant.public_id}/images`,
        )
        .set("Cookie", cookie!);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.map((i: { public_id: string }) => i.public_id)).toEqual([
        second.public_id,
        first.public_id,
      ]);
      expect(response.body.pagination.total).toBe(2);
      expect(response.body.data[0].product_variant_public_id).toBe(variant.public_id);
      expect(response.body.data[0]).not.toHaveProperty("id");
      expect(response.body.data[0]).not.toHaveProperty("created_at");
      expect(response.body.data[0]).not.toHaveProperty("updated_at");
    });

    it("returns 404 for an unknown variant", async () => {
      const { cookie } = await createAdminUser(app);
      const product = await createProduct();

      const response = await request(app)
        .get(
          `/api/v1/admin/products/${product.public_id}/variants/var_${nanoid(10)}/images`,
        )
        .set("Cookie", cookie!);

      expect(response.status).toBe(404);
    });

    it("returns 404 for a variant of another product", async () => {
      const { cookie } = await createAdminUser(app);
      const product = await createProduct();
      const otherProduct = await createProduct();
      const variant = await createVariant(product.id);

      const response = await request(app)
        .get(
          `/api/v1/admin/products/${otherProduct.public_id}/variants/${variant.public_id}/images`,
        )
        .set("Cookie", cookie!);

      expect(response.status).toBe(404);
    });
  });

  describe("POST /api/v1/admin/products/:product_public_id/variants/:variant_public_id/images", () => {
    it("creates a variant image with display_order 0 (201)", async () => {
      const { cookie } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);

      const response = await request(app)
        .post(
          `/api/v1/admin/products/${product.public_id}/variants/${variant.public_id}/images`,
        )
        .set("Cookie", cookie!)
        .send(variantImagePayload());

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.public_id).toMatch(/^vimg_/);
      expect(response.body.data.product_variant_public_id).toBe(variant.public_id);
      expect(response.body.data.display_order).toBe(0);
      expect(response.body.data).not.toHaveProperty("id");
      expect(response.body.data).not.toHaveProperty("created_at");
      expect(response.body.data).not.toHaveProperty("updated_at");
    });

    it("appends the display_order when omitted (201)", async () => {
      const { cookie } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);
      await createVariantImage(variant.id, { display_order: 0 });

      const response = await request(app)
        .post(
          `/api/v1/admin/products/${product.public_id}/variants/${variant.public_id}/images`,
        )
        .set("Cookie", cookie!)
        .send(variantImagePayload());

      expect(response.status).toBe(201);
      expect(response.body.data.display_order).toBe(1);
    });

    it("returns 409 for a duplicate display_order", async () => {
      const { cookie } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);
      await createVariantImage(variant.id, { display_order: 3 });

      const response = await request(app)
        .post(
          `/api/v1/admin/products/${product.public_id}/variants/${variant.public_id}/images`,
        )
        .set("Cookie", cookie!)
        .send(variantImagePayload({ display_order: 3 }));

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    it("rejects an invalid image_url (400)", async () => {
      const { cookie } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);

      const response = await request(app)
        .post(
          `/api/v1/admin/products/${product.public_id}/variants/${variant.public_id}/images`,
        )
        .set("Cookie", cookie!)
        .send({ image_url: "javascript:alert(1)" });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/v1/admin/products/:product_public_id/variants/:variant_public_id/images/:variant_image_public_id", () => {
    it("returns a single variant image (200)", async () => {
      const { cookie } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);
      const image = await createVariantImage(variant.id);

      const response = await request(app)
        .get(
          `/api/v1/admin/products/${product.public_id}/variants/${variant.public_id}/images/${image.public_id}`,
        )
        .set("Cookie", cookie!);

      expect(response.status).toBe(200);
      expect(response.body.data.public_id).toBe(image.public_id);
      expect(response.body.data.product_variant_public_id).toBe(variant.public_id);
    });

    it("returns 404 for an image of another variant", async () => {
      const { cookie } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);
      const otherVariant = await createVariant(product.id);
      const image = await createVariantImage(variant.id);

      const response = await request(app)
        .get(
          `/api/v1/admin/products/${product.public_id}/variants/${otherVariant.public_id}/images/${image.public_id}`,
        )
        .set("Cookie", cookie!);

      expect(response.status).toBe(404);
    });
  });

  describe("PATCH /api/v1/admin/products/:product_public_id/variants/:variant_public_id/images/:variant_image_public_id", () => {
    it("updates the image and clears alt_text with null (200)", async () => {
      const { cookie } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);
      const image = await createVariantImage(variant.id, { alt_text: "Old alt" });

      const response = await request(app)
        .patch(
          `/api/v1/admin/products/${product.public_id}/variants/${variant.public_id}/images/${image.public_id}`,
        )
        .set("Cookie", cookie!)
        .send({ alt_text: null, display_order: 4 });

      expect(response.status).toBe(200);
      expect(response.body.data.alt_text).toBeNull();
      expect(response.body.data.display_order).toBe(4);
    });

    it("returns 409 for a display_order conflict", async () => {
      const { cookie } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);
      const first = await createVariantImage(variant.id, { display_order: 1 });
      const second = await createVariantImage(variant.id, { display_order: 2 });

      const response = await request(app)
        .patch(
          `/api/v1/admin/products/${product.public_id}/variants/${variant.public_id}/images/${second.public_id}`,
        )
        .set("Cookie", cookie!)
        .send({ display_order: 1 });

      expect(response.status).toBe(409);
    });
  });

  describe("DELETE /api/v1/admin/products/:product_public_id/variants/:variant_public_id/images/:variant_image_public_id", () => {
    it("hard-deletes the image (204) and removes it from the list", async () => {
      const { cookie } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);
      const image = await createVariantImage(variant.id);

      const response = await request(app)
        .delete(
          `/api/v1/admin/products/${product.public_id}/variants/${variant.public_id}/images/${image.public_id}`,
        )
        .set("Cookie", cookie!);

      expect(response.status).toBe(204);

      const listResponse = await request(app)
        .get(
          `/api/v1/admin/products/${product.public_id}/variants/${variant.public_id}/images`,
        )
        .set("Cookie", cookie!);
      expect(listResponse.body.data).toEqual([]);
    });

    it("returns 404 for an image of another variant", async () => {
      const { cookie } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);
      const otherVariant = await createVariant(product.id);
      const image = await createVariantImage(variant.id);

      const response = await request(app)
        .delete(
          `/api/v1/admin/products/${product.public_id}/variants/${otherVariant.public_id}/images/${image.public_id}`,
        )
        .set("Cookie", cookie!);

      expect(response.status).toBe(404);
    });
  });
});
