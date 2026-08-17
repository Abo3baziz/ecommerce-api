import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { nanoid } from "nanoid";
import { app } from "../../../src/app/index.js";
import { createAdminUser, registerUser, csrfHeaders } from "../../helpers/auth.js";
import { cleanupTestData } from "../../helpers/db.js";
import { createProduct } from "../../factories/product.factory.js";
import { createVariant } from "../../factories/variant.factory.js";

function variantPayload(overrides: Record<string, unknown> = {}) {
  return {
    sku: `SW-HP-${nanoid(6)}`,
    barcode: "4006381333931",
    color: "Black",
    size: "M",
    price: "129.99",
    cost_price: "85.00",
    discount_percentage: "10.00",
    weight: "0.25",
    status: "ACTIVE",
    ...overrides,
  };
}

describe("product variants API", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("authentication and authorization", () => {
    it("returns 401 without a session", async () => {
      const product = await createProduct();

      const response = await request(app).get(
        `/api/v1/admin/products/${product.public_id}/variants`,
      );

      expect(response.status).toBe(401);
    });

    it("returns 403 for a non-admin session", async () => {
      const product = await createProduct();
      const { cookie, csrf } = await registerUser(app);

      const response = await request(app)
        .get(`/api/v1/admin/products/${product.public_id}/variants`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(403);
    });
  });

  describe("GET /api/v1/admin/products/:product_public_id/variants", () => {
    it("lists the product's variants with pagination metadata (200)", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);

      const response = await request(app)
        .get(`/api/v1/admin/products/${product.public_id}/variants`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.map((v: { public_id: string }) => v.public_id)).toEqual([
        variant.public_id,
      ]);
      expect(response.body.data[0]).not.toHaveProperty("id");
    });

    it("filters by status (200)", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct();
      const draft = await createVariant(product.id, { status: "DRAFT" });
      await createVariant(product.id, { status: "ACTIVE" });

      const response = await request(app)
        .get(`/api/v1/admin/products/${product.public_id}/variants?status=DRAFT`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(200);
      expect(response.body.data.map((v: { public_id: string }) => v.public_id)).toEqual([
        draft.public_id,
      ]);
    });

    it("returns 404 for an unknown product", async () => {
      const { cookie, csrf } = await createAdminUser(app);

      const response = await request(app)
        .get(`/api/v1/admin/products/prd_${nanoid(10)}/variants`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(404);
    });
  });

  describe("POST /api/v1/admin/products/:product_public_id/variants", () => {
    it("creates a variant defaulting status to ACTIVE and discount to 0.00 (201)", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct();

      const response = await request(app)
        .post(`/api/v1/admin/products/${product.public_id}/variants`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ sku: "SW-HP-001", price: "99.99" });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.public_id).toMatch(/^var_/);
      expect(response.body.data.status).toBe("ACTIVE");
      expect(response.body.data.discount_percentage).toBe("0.00");
      expect(response.body.data).not.toHaveProperty("id");
    });

    it("returns 409 for a duplicate SKU", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);

      const response = await request(app)
        .post(`/api/v1/admin/products/${product.public_id}/variants`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ sku: variant.sku, price: "99.99" });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    it("rejects an invalid payload (400)", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct();

      const response = await request(app)
        .post(`/api/v1/admin/products/${product.public_id}/variants`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ sku: "", price: "-5.00" });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/v1/admin/products/:product_public_id/variants/:variant_public_id", () => {
    it("returns the variant with its images (200)", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);

      const response = await request(app)
        .get(`/api/v1/admin/products/${product.public_id}/variants/${variant.public_id}`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(200);
      expect(response.body.data.public_id).toBe(variant.public_id);
      expect(response.body.data.product_public_id).toBe(product.public_id);
      expect(response.body.data.images).toEqual([]);
    });

    it("returns 404 for a variant that does not belong to the product", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct();
      const otherProduct = await createProduct();
      const variant = await createVariant(product.id);

      const response = await request(app)
        .get(`/api/v1/admin/products/${otherProduct.public_id}/variants/${variant.public_id}`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(404);
    });
  });

  describe("PATCH /api/v1/admin/products/:product_public_id/variants/:variant_public_id", () => {
    it("updates the variant and clears fields with null (200)", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id, { barcode: "12345" });

      const response = await request(app)
        .patch(`/api/v1/admin/products/${product.public_id}/variants/${variant.public_id}`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ price: "119.99", barcode: null });

      expect(response.status).toBe(200);
      expect(response.body.data.price).toBe("119.99");
      expect(response.body.data.barcode).toBeNull();
    });

    it("returns 409 for a duplicate SKU", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct();
      const first = await createVariant(product.id);
      const second = await createVariant(product.id);

      const response = await request(app)
        .patch(`/api/v1/admin/products/${product.public_id}/variants/${second.public_id}`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ sku: first.sku });

      expect(response.status).toBe(409);
    });
  });

  describe("DELETE /api/v1/admin/products/:product_public_id/variants/:variant_public_id", () => {
    it("soft-deletes the variant (204) and hides it from the list", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);

      const response = await request(app)
        .delete(`/api/v1/admin/products/${product.public_id}/variants/${variant.public_id}`)
        .set(csrfHeaders(cookie!, csrf!))

      expect(response.status).toBe(204);

      const listResponse = await request(app)
        .get(`/api/v1/admin/products/${product.public_id}/variants`)
        .set("Cookie", cookie!);
      expect(listResponse.body.data).toEqual([]);
    });

    it("returns 404 for an already deleted variant", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id, { deleted_at: new Date() });

      const response = await request(app)
        .delete(`/api/v1/admin/products/${product.public_id}/variants/${variant.public_id}`)
        .set(csrfHeaders(cookie!, csrf!))

      expect(response.status).toBe(404);
    });
  });
});
