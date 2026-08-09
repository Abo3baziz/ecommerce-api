import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { nanoid } from "nanoid";
import { app } from "../../../src/app/index.js";
import { createAdminUser, registerUser } from "../../helpers/auth.js";
import { cleanupTestData } from "../../helpers/db.js";
import { createProduct } from "../../factories/product.factory.js";
import { createVariant } from "../../factories/variant.factory.js";

const PUBLIC_BASE_URL = "/api/v1/products";
const ADMIN_BASE_URL = "/api/v1/admin/products";

function createProductPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: `Headphones ${nanoid(6)}`,
    slug: `headphones-${nanoid(6)}`,
    description: "Premium over-ear headphones.",
    brand: "SoundWave",
    ...overrides,
  };
}

describe("products API", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("customer catalog", () => {
    describe("GET /api/v1/products", () => {
      it("returns an empty list with pagination metadata (200)", async () => {
        const response = await request(app).get(PUBLIC_BASE_URL);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data).toEqual([]);
        expect(response.body.pagination).toEqual({
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        });
      });

      it("only lists products that have an active variant (200)", async () => {
        const visible = await createProduct({ name: "Wireless Headphones" });
        await createVariant(visible.id);
        await createProduct({ name: "Variantless Product" });

        const response = await request(app).get(PUBLIC_BASE_URL);

        expect(response.status).toBe(200);
        expect(response.body.data.map((product: { public_id: string }) => product.public_id)).toEqual(
          [visible.public_id],
        );
        expect(response.body.data[0]).not.toHaveProperty("id");
      });

      it("rejects an invalid sort field (400)", async () => {
        const response = await request(app).get(`${PUBLIC_BASE_URL}?sort=price`);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe("GET /api/v1/products/:product_public_id", () => {
      it("returns the product detail with final_price (200)", async () => {
        const product = await createProduct({ name: "Wireless Headphones" });
        await createVariant(product.id, {
          sku: "SW-HP-001",
          price: "129.99",
          discount_percentage: "10.00",
        });

        const response = await request(app).get(
          `${PUBLIC_BASE_URL}/${product.public_id}`,
        );

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.public_id).toBe(product.public_id);
        expect(response.body.data.variants[0].final_price).toBe("116.99");
        expect(response.body.data.variants[0]).not.toHaveProperty("cost_price");
        expect(response.body.data.variants[0]).not.toHaveProperty("status");
        expect(response.body.data).not.toHaveProperty("deleted_at");
        expect(response.body.data).not.toHaveProperty("id");
      });

      it("returns 404 for a product without an active variant", async () => {
        const product = await createProduct();

        const response = await request(app).get(
          `${PUBLIC_BASE_URL}/${product.public_id}`,
        );

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
      });

      it("returns 404 for an unknown product", async () => {
        const response = await request(app).get(
          `${PUBLIC_BASE_URL}/prd_${nanoid(10)}`,
        );

        expect(response.status).toBe(404);
      });
    });
  });

  describe("admin product management", () => {
    describe("authentication and authorization", () => {
      it("returns 401 without a session", async () => {
        const response = await request(app).get(ADMIN_BASE_URL);

        expect(response.status).toBe(401);
      });

      it("returns 403 for a non-admin session", async () => {
        const { cookie } = await registerUser(app);

        const response = await request(app)
          .get(ADMIN_BASE_URL)
          .set("Cookie", cookie!);

        expect(response.status).toBe(403);
      });
    });

    describe("GET /api/v1/admin/products", () => {
      it("lists products and excludes deleted ones by default (200)", async () => {
        const { cookie } = await createAdminUser(app);
        const active = await createProduct();
        await createVariant(active.id);
        await createProduct({ deleted_at: new Date() });

        const response = await request(app)
          .get(ADMIN_BASE_URL)
          .set("Cookie", cookie!);

        expect(response.status).toBe(200);
        expect(response.body.data.map((p: { public_id: string }) => p.public_id)).toEqual([
          active.public_id,
        ]);
      });

      it("includes deleted products when include_deleted=true (200)", async () => {
        const { cookie } = await createAdminUser(app);
        const deleted = await createProduct({ deleted_at: new Date() });
        await createVariant(deleted.id);

        const response = await request(app)
          .get(`${ADMIN_BASE_URL}?include_deleted=true`)
          .set("Cookie", cookie!);

        expect(response.status).toBe(200);
        expect(response.body.data.map((p: { public_id: string }) => p.public_id)).toContain(
          deleted.public_id,
        );
        expect(response.body.data[0]).not.toHaveProperty("deleted_at");
      });
    });

    describe("POST /api/v1/admin/products", () => {
      it("creates a product and auto-generates a slug (201)", async () => {
        const { cookie } = await createAdminUser(app);

        const response = await request(app)
          .post(ADMIN_BASE_URL)
          .set("Cookie", cookie!)
          .send({ name: "Wireless Noise-Cancelling Headphones" });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.public_id).toMatch(/^prd_/);
        expect(response.body.data.slug).toBe("wireless-noise-cancelling-headphones");
        expect(response.body.data).not.toHaveProperty("id");
      });

      it("returns 409 for a duplicate slug", async () => {
        const { cookie } = await createAdminUser(app);
        await createProduct({ slug: "existing-slug" });

        const response = await request(app)
          .post(ADMIN_BASE_URL)
          .set("Cookie", cookie!)
          .send({ name: "New Product", slug: "existing-slug" });

        expect(response.status).toBe(409);
        expect(response.body.success).toBe(false);
      });

      it("rejects a malformed slug (400)", async () => {
        const { cookie } = await createAdminUser(app);

        const response = await request(app)
          .post(ADMIN_BASE_URL)
          .set("Cookie", cookie!)
          .send({ name: "New Product", slug: "Invalid Slug!" });

        expect(response.status).toBe(400);
      });
    });

    describe("GET /api/v1/admin/products/:product_public_id", () => {
      it("returns the admin detail (200)", async () => {
        const { cookie } = await createAdminUser(app);
        const product = await createProduct();
        await createVariant(product.id, { cost_price: "85.00" });

        const response = await request(app)
          .get(`${ADMIN_BASE_URL}/${product.public_id}`)
          .set("Cookie", cookie!);

        expect(response.status).toBe(200);
        expect(response.body.data.variants[0].cost_price).toBe("85.00");
        expect(response.body.data.variants[0].status).toBe("ACTIVE");
      });

      it("returns 404 for a soft-deleted product", async () => {
        const { cookie } = await createAdminUser(app);
        const product = await createProduct({ deleted_at: new Date() });

        const response = await request(app)
          .get(`${ADMIN_BASE_URL}/${product.public_id}`)
          .set("Cookie", cookie!);

        expect(response.status).toBe(404);
      });
    });

    describe("PATCH /api/v1/admin/products/:product_public_id", () => {
      it("updates the product (200)", async () => {
        const { cookie } = await createAdminUser(app);
        const product = await createProduct({ brand: "OldBrand" });

        const response = await request(app)
          .patch(`${ADMIN_BASE_URL}/${product.public_id}`)
          .set("Cookie", cookie!)
          .send({ name: "Updated Product", brand: null });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe("Updated Product");
        expect(response.body.data.brand).toBeNull();
      });

      it("returns 409 for a slug conflict", async () => {
        const { cookie } = await createAdminUser(app);
        const first = await createProduct({ slug: "first-slug" });
        const second = await createProduct({ slug: "second-slug" });

        const response = await request(app)
          .patch(`${ADMIN_BASE_URL}/${second.public_id}`)
          .set("Cookie", cookie!)
          .send({ slug: "first-slug" });

        expect(response.status).toBe(409);
      });
    });

    describe("DELETE /api/v1/admin/products/:product_public_id", () => {
      it("soft-deletes the product and its variants (204)", async () => {
        const { cookie } = await createAdminUser(app);
        const product = await createProduct();
        await createVariant(product.id);

        const response = await request(app)
          .delete(`${ADMIN_BASE_URL}/${product.public_id}`)
          .set("Cookie", cookie!);

        expect(response.status).toBe(204);

        const getResponse = await request(app)
          .get(`${ADMIN_BASE_URL}/${product.public_id}`)
          .set("Cookie", cookie!);
        expect(getResponse.status).toBe(404);
      });

      it("returns 404 for an already deleted product", async () => {
        const { cookie } = await createAdminUser(app);
        const product = await createProduct({ deleted_at: new Date() });

        const response = await request(app)
          .delete(`${ADMIN_BASE_URL}/${product.public_id}`)
          .set("Cookie", cookie!);

        expect(response.status).toBe(404);
      });
    });
  });
});
