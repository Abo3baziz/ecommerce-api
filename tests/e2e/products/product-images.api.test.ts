import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { nanoid } from "nanoid";
import { app } from "../../../src/app/index.js";
import { createAdminUser, registerUser } from "../../helpers/auth.js";
import { cleanupTestData } from "../../helpers/db.js";
import { createProduct } from "../../factories/product.factory.js";
import { createProductImage } from "../../factories/product-image.factory.js";

function imagePayload(overrides: Record<string, unknown> = {}) {
  return {
    image_url: `https://cdn.example.com/${nanoid(6)}.jpg`,
    alt_text: "Hero image",
    ...overrides,
  };
}

describe("product images API", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("authentication and authorization", () => {
    it("returns 401 without a session", async () => {
      const product = await createProduct();

      const response = await request(app).get(
        `/api/v1/admin/products/${product.public_id}/images`,
      );

      expect(response.status).toBe(401);
    });

    it("returns 403 for a non-admin session", async () => {
      const product = await createProduct();
      const { cookie } = await registerUser(app);

      const response = await request(app)
        .get(`/api/v1/admin/products/${product.public_id}/images`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(403);
    });
  });

  describe("GET /api/v1/admin/products/:product_public_id/images", () => {
    it("lists the product's images ordered by display_order (200)", async () => {
      const { cookie } = await createAdminUser(app);
      const product = await createProduct();
      const first = await createProductImage(product.id, { display_order: 1 });
      const second = await createProductImage(product.id, { display_order: 0 });

      const response = await request(app)
        .get(`/api/v1/admin/products/${product.public_id}/images`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.map((i: { public_id: string }) => i.public_id)).toEqual([
        second.public_id,
        first.public_id,
      ]);
      expect(response.body.pagination.total).toBe(2);
      expect(response.body.data[0].product_public_id).toBe(product.public_id);
      expect(response.body.data[0]).not.toHaveProperty("id");
      expect(response.body.data[0]).toHaveProperty("created_at");
      expect(response.body.data[0]).toHaveProperty("updated_at");
    });

    it("returns 404 for an unknown product", async () => {
      const { cookie } = await createAdminUser(app);

      const response = await request(app)
        .get(`/api/v1/admin/products/prd_${nanoid(10)}/images`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(404);
    });
  });

  describe("POST /api/v1/admin/products/:product_public_id/images", () => {
    it("creates the first image as primary with display_order 0 (201)", async () => {
      const { cookie } = await createAdminUser(app);
      const product = await createProduct();

      const response = await request(app)
        .post(`/api/v1/admin/products/${product.public_id}/images`)
        .set("Cookie", cookie!)
        .send(imagePayload());

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.public_id).toMatch(/^pimg_/);
      expect(response.body.data.display_order).toBe(0);
      expect(response.body.data.is_primary).toBe(true);
      expect(response.body.data).not.toHaveProperty("id");
    });

    it("appends the display_order when omitted (201)", async () => {
      const { cookie } = await createAdminUser(app);
      const product = await createProduct();
      await createProductImage(product.id, { display_order: 0 });

      const response = await request(app)
        .post(`/api/v1/admin/products/${product.public_id}/images`)
        .set("Cookie", cookie!)
        .send(imagePayload());

      expect(response.status).toBe(201);
      expect(response.body.data.display_order).toBe(1);
      expect(response.body.data.is_primary).toBe(false);
    });

    it("demotes the previous primary when is_primary=true (201)", async () => {
      const { cookie } = await createAdminUser(app);
      const product = await createProduct();
      const first = await createProductImage(product.id, { display_order: 0 });

      const response = await request(app)
        .post(`/api/v1/admin/products/${product.public_id}/images`)
        .set("Cookie", cookie!)
        .send(imagePayload({ is_primary: true }));

      expect(response.status).toBe(201);
      expect(response.body.data.is_primary).toBe(true);

      const getResponse = await request(app)
        .get(`/api/v1/admin/products/${product.public_id}/images/${first.public_id}`)
        .set("Cookie", cookie!);
      expect(getResponse.body.data.is_primary).toBe(false);
    });

    it("returns 409 for a duplicate display_order", async () => {
      const { cookie } = await createAdminUser(app);
      const product = await createProduct();
      await createProductImage(product.id, { display_order: 2 });

      const response = await request(app)
        .post(`/api/v1/admin/products/${product.public_id}/images`)
        .set("Cookie", cookie!)
        .send(imagePayload({ display_order: 2 }));

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    it("rejects an invalid image_url (400)", async () => {
      const { cookie } = await createAdminUser(app);
      const product = await createProduct();

      const response = await request(app)
        .post(`/api/v1/admin/products/${product.public_id}/images`)
        .set("Cookie", cookie!)
        .send({ image_url: "not-a-url" });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/v1/admin/products/:product_public_id/images/:image_public_id", () => {
    it("returns a single image (200)", async () => {
      const { cookie } = await createAdminUser(app);
      const product = await createProduct();
      const image = await createProductImage(product.id);

      const response = await request(app)
        .get(`/api/v1/admin/products/${product.public_id}/images/${image.public_id}`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(200);
      expect(response.body.data.public_id).toBe(image.public_id);
      expect(response.body.data.product_public_id).toBe(product.public_id);
    });

    it("returns 404 for an image of another product", async () => {
      const { cookie } = await createAdminUser(app);
      const product = await createProduct();
      const otherProduct = await createProduct();
      const image = await createProductImage(product.id);

      const response = await request(app)
        .get(`/api/v1/admin/products/${otherProduct.public_id}/images/${image.public_id}`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(404);
    });
  });

  describe("PATCH /api/v1/admin/products/:product_public_id/images/:image_public_id", () => {
    it("updates the image and clears alt_text with null (200)", async () => {
      const { cookie } = await createAdminUser(app);
      const product = await createProduct();
      const image = await createProductImage(product.id, { alt_text: "Old alt" });

      const response = await request(app)
        .patch(`/api/v1/admin/products/${product.public_id}/images/${image.public_id}`)
        .set("Cookie", cookie!)
        .send({ alt_text: null, display_order: 5 });

      expect(response.status).toBe(200);
      expect(response.body.data.alt_text).toBeNull();
      expect(response.body.data.display_order).toBe(5);
    });

    it("returns 409 for a display_order conflict", async () => {
      const { cookie } = await createAdminUser(app);
      const product = await createProduct();
      const first = await createProductImage(product.id, { display_order: 1 });
      const second = await createProductImage(product.id, { display_order: 2 });

      const response = await request(app)
        .patch(`/api/v1/admin/products/${product.public_id}/images/${second.public_id}`)
        .set("Cookie", cookie!)
        .send({ display_order: 1 });

      expect(response.status).toBe(409);
    });

    it("returns 400 when clearing the primary flag on the only image", async () => {
      const { cookie } = await createAdminUser(app);
      const product = await createProduct();
      const image = await createProductImage(product.id, { is_primary: true });

      const response = await request(app)
        .patch(`/api/v1/admin/products/${product.public_id}/images/${image.public_id}`)
        .set("Cookie", cookie!)
        .send({ is_primary: false });

      expect(response.status).toBe(400);
    });
  });

  describe("DELETE /api/v1/admin/products/:product_public_id/images/:image_public_id", () => {
    it("hard-deletes the image (204) and removes it from the list", async () => {
      const { cookie } = await createAdminUser(app);
      const product = await createProduct();
      const image = await createProductImage(product.id);

      const response = await request(app)
        .delete(`/api/v1/admin/products/${product.public_id}/images/${image.public_id}`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(204);

      const listResponse = await request(app)
        .get(`/api/v1/admin/products/${product.public_id}/images`)
        .set("Cookie", cookie!);
      expect(listResponse.body.data).toEqual([]);
    });

    it("promotes the lowest display_order image when the primary is deleted", async () => {
      const { cookie } = await createAdminUser(app);
      const product = await createProduct();
      const primary = await createProductImage(product.id, { display_order: 0, is_primary: true });
      const second = await createProductImage(product.id, { display_order: 2, is_primary: false });
      await createProductImage(product.id, { display_order: 1, is_primary: false });

      const response = await request(app)
        .delete(`/api/v1/admin/products/${product.public_id}/images/${primary.public_id}`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(204);

      const getResponse = await request(app)
        .get(`/api/v1/admin/products/${product.public_id}/images/${second.public_id}`)
        .set("Cookie", cookie!);
      expect(getResponse.body.data.is_primary).toBe(false);

      const listResponse = await request(app)
        .get(`/api/v1/admin/products/${product.public_id}/images`)
        .set("Cookie", cookie!);
      const promoted = listResponse.body.data.find(
        (i: { display_order: number }) => i.display_order === 1,
      );
      expect(promoted.is_primary).toBe(true);
    });

    it("returns 404 for an image of another product", async () => {
      const { cookie } = await createAdminUser(app);
      const product = await createProduct();
      const otherProduct = await createProduct();
      const image = await createProductImage(product.id);

      const response = await request(app)
        .delete(`/api/v1/admin/products/${otherProduct.public_id}/images/${image.public_id}`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(404);
    });
  });
});
