import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { nanoid } from "nanoid";
import { app } from "../../../src/app/index.js";
import { createAdminUser, registerUser, csrfHeaders } from "../../helpers/auth.js";
import { cleanupTestData } from "../../helpers/db.js";
import { createCategory } from "../../factories/category.factory.js";
import { createCategoryProductLink } from "../../factories/category-product.factory.js";
import { createProduct } from "../../factories/product.factory.js";
import { createVariant } from "../../factories/variant.factory.js";

const PUBLIC_BASE_URL = "/api/v1/categories";
const ADMIN_BASE_URL = "/api/v1/admin/categories";

function createCategoryPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: `Headphones ${nanoid(6)}`,
    slug: `headphones-${nanoid(6)}`,
    description: "Wired and wireless headphones.",
    is_active: true,
    ...overrides,
  };
}

async function visibleProduct() {
  const product = await createProduct();
  await createVariant(product.id);
  return product;
}

describe("categories API", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("customer catalog", () => {
    describe("GET /api/v1/categories", () => {
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

      it("only lists active, non-deleted categories (200)", async () => {
        const active = await createCategory({ name: "Headphones" });
        await createCategory({ name: "Hidden", is_active: false });
        await createCategory({ name: "Deleted", deleted_at: new Date() });

        const response = await request(app).get(PUBLIC_BASE_URL);

        expect(response.status).toBe(200);
        expect(response.body.data.map((c: { public_id: string }) => c.public_id)).toEqual([
          active.public_id,
        ]);
        expect(response.body.data[0]).not.toHaveProperty("is_active");
        expect(response.body.data[0]).not.toHaveProperty("id");
        expect(response.body.data[0]).not.toHaveProperty("deleted_at");
      });

      it("rejects an invalid sort field (400)", async () => {
        const response = await request(app).get(`${PUBLIC_BASE_URL}?sort=price`);

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe("GET /api/v1/categories/:category_public_id", () => {
      it("returns the category with a product_count (200)", async () => {
        const category = await createCategory({ name: "Headphones" });
        const product = await visibleProduct();
        await createCategoryProductLink(category.id, product.id);

        const response = await request(app).get(
          `${PUBLIC_BASE_URL}/${category.public_id}`,
        );

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.public_id).toBe(category.public_id);
        expect(response.body.data.product_count).toBe(1);
        expect(response.body.data).not.toHaveProperty("is_active");
        expect(response.body.data).not.toHaveProperty("deleted_at");
        expect(response.body.data).not.toHaveProperty("id");
      });

      it("returns 404 for an inactive category", async () => {
        const category = await createCategory({ is_active: false });

        const response = await request(app).get(
          `${PUBLIC_BASE_URL}/${category.public_id}`,
        );

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
      });

      it("returns 404 for an unknown category", async () => {
        const response = await request(app).get(
          `${PUBLIC_BASE_URL}/cat_${nanoid(10)}`,
        );

        expect(response.status).toBe(404);
      });
    });

    describe("GET /api/v1/categories/:category_public_id/products", () => {
      it("lists the customer-visible products of the category (200)", async () => {
        const category = await createCategory({ name: "Headphones" });
        const product = await visibleProduct();
        await createCategoryProductLink(category.id, product.id);

        const response = await request(app).get(
          `${PUBLIC_BASE_URL}/${category.public_id}/products`,
        );

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.map((p: { public_id: string }) => p.public_id)).toEqual([
          product.public_id,
        ]);
        expect(response.body.data[0]).toHaveProperty("brand");
        expect(response.body.data[0]).not.toHaveProperty("id");
        expect(response.body.pagination.total).toBe(1);
      });

      it("returns 404 when the category is inactive", async () => {
        const category = await createCategory({ is_active: false });

        const response = await request(app).get(
          `${PUBLIC_BASE_URL}/${category.public_id}/products`,
        );

        expect(response.status).toBe(404);
      });
    });
  });

  describe("admin category management", () => {
    describe("authentication and authorization", () => {
      it("returns 401 without a session", async () => {
        const response = await request(app).get(ADMIN_BASE_URL);

        expect(response.status).toBe(401);
      });

      it("returns 403 for a non-admin session", async () => {
        const { cookie, csrf } = await registerUser(app);

        const response = await request(app)
          .get(ADMIN_BASE_URL)
          .set("Cookie", cookie!);

        expect(response.status).toBe(403);
      });
    });

    describe("GET /api/v1/admin/categories", () => {
      it("lists categories and excludes deleted ones by default (200)", async () => {
        const { cookie, csrf } = await createAdminUser(app);
        const active = await createCategory({ name: "Headphones" });
        await createCategory({ name: "Deleted", deleted_at: new Date() });

        const response = await request(app)
          .get(ADMIN_BASE_URL)
          .set("Cookie", cookie!);

        expect(response.status).toBe(200);
        expect(response.body.data.map((c: { public_id: string }) => c.public_id)).toEqual([
          active.public_id,
        ]);
        expect(response.body.data[0]).toHaveProperty("is_active");
        expect(response.body.data[0]).not.toHaveProperty("deleted_at");
      });

      it("includes deleted categories when include_deleted=true (200)", async () => {
        const { cookie, csrf } = await createAdminUser(app);
        const deleted = await createCategory({ deleted_at: new Date() });

        const response = await request(app)
          .get(`${ADMIN_BASE_URL}?include_deleted=true`)
          .set("Cookie", cookie!);

        expect(response.status).toBe(200);
        expect(response.body.data.map((c: { public_id: string }) => c.public_id)).toContain(
          deleted.public_id,
        );
        expect(response.body.data[0]).not.toHaveProperty("deleted_at");
      });

      it("filters by is_active (200)", async () => {
        const { cookie, csrf } = await createAdminUser(app);
        await createCategory({ name: "Active" });
        const hidden = await createCategory({ name: "Hidden", is_active: false });

        const response = await request(app)
          .get(`${ADMIN_BASE_URL}?is_active=false`)
          .set("Cookie", cookie!);

        expect(response.status).toBe(200);
        expect(response.body.data.map((c: { public_id: string }) => c.public_id)).toEqual([
          hidden.public_id,
        ]);
      });
    });

    describe("POST /api/v1/admin/categories", () => {
      it("creates a category and auto-generates a slug (201)", async () => {
        const { cookie, csrf } = await createAdminUser(app);

        const response = await request(app)
          .post(ADMIN_BASE_URL)
          .set(csrfHeaders(cookie!, csrf!))
          .send({ name: "Wireless Noise-Cancelling Headphones" });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.public_id).toMatch(/^cat_/);
        expect(response.body.data.slug).toBe("wireless-noise-cancelling-headphones");
        expect(response.body.data.is_active).toBe(true);
        expect(response.body.data).not.toHaveProperty("id");
      });

      it("returns 409 for a duplicate slug", async () => {
        const { cookie, csrf } = await createAdminUser(app);
        await createCategory({ slug: "existing-slug" });

        const response = await request(app)
          .post(ADMIN_BASE_URL)
          .set(csrfHeaders(cookie!, csrf!))
          .send({ name: "New Category", slug: "existing-slug" });

        expect(response.status).toBe(409);
        expect(response.body.success).toBe(false);
      });

      it("returns 409 for a duplicate name", async () => {
        const { cookie, csrf } = await createAdminUser(app);
        await createCategory({ name: "Headphones" });

        const response = await request(app)
          .post(ADMIN_BASE_URL)
          .set(csrfHeaders(cookie!, csrf!))
          .send({ name: "Headphones" });

        expect(response.status).toBe(409);
        expect(response.body.success).toBe(false);
      });

      it("rejects a malformed slug (400)", async () => {
        const { cookie, csrf } = await createAdminUser(app);

        const response = await request(app)
          .post(ADMIN_BASE_URL)
          .set(csrfHeaders(cookie!, csrf!))
          .send({ name: "New Category", slug: "Invalid Slug!" });

        expect(response.status).toBe(400);
      });
    });

    describe("GET /api/v1/admin/categories/:category_public_id", () => {
      it("returns the admin detail (200)", async () => {
        const { cookie, csrf } = await createAdminUser(app);
        const category = await createCategory({ name: "Headphones" });
        const product = await visibleProduct();
        await createCategoryProductLink(category.id, product.id);

        const response = await request(app)
          .get(`${ADMIN_BASE_URL}/${category.public_id}`)
          .set("Cookie", cookie!);

        expect(response.status).toBe(200);
        expect(response.body.data.is_active).toBe(true);
        expect(response.body.data.product_count).toBe(1);
      });

      it("returns 404 for a soft-deleted category", async () => {
        const { cookie, csrf } = await createAdminUser(app);
        const category = await createCategory({ deleted_at: new Date() });

        const response = await request(app)
          .get(`${ADMIN_BASE_URL}/${category.public_id}`)
          .set("Cookie", cookie!);

        expect(response.status).toBe(404);
      });
    });

    describe("PATCH /api/v1/admin/categories/:category_public_id", () => {
      it("updates the category (200)", async () => {
        const { cookie, csrf } = await createAdminUser(app);
        const category = await createCategory({ name: "Original Name" });

        const response = await request(app)
          .patch(`${ADMIN_BASE_URL}/${category.public_id}`)
          .set(csrfHeaders(cookie!, csrf!))
          .send({ name: "Headphones & Earbuds", description: null, is_active: false });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.name).toBe("Headphones & Earbuds");
        expect(response.body.data.description).toBeNull();
        expect(response.body.data.is_active).toBe(false);
      });

      it("returns 409 for a name conflict", async () => {
        const { cookie, csrf } = await createAdminUser(app);
        await createCategory({ name: "Existing Name" });
        const category = await createCategory({ name: "My Category" });

        const response = await request(app)
          .patch(`${ADMIN_BASE_URL}/${category.public_id}`)
          .set(csrfHeaders(cookie!, csrf!))
          .send({ name: "Existing Name" });

        expect(response.status).toBe(409);
      });
    });

    describe("DELETE /api/v1/admin/categories/:category_public_id", () => {
      it("soft-deletes the category and removes its links (204)", async () => {
        const { cookie, csrf } = await createAdminUser(app);
        const category = await createCategory({ name: "Headphones" });
        const product = await visibleProduct();
        await createCategoryProductLink(category.id, product.id);

        const response = await request(app)
          .delete(`${ADMIN_BASE_URL}/${category.public_id}`)
          .set(csrfHeaders(cookie!, csrf!))

        expect(response.status).toBe(204);

        const getResponse = await request(app)
          .get(`${ADMIN_BASE_URL}/${category.public_id}`)
          .set("Cookie", cookie!);
        expect(getResponse.status).toBe(404);
      });

      it("returns 404 for an already deleted category", async () => {
        const { cookie, csrf } = await createAdminUser(app);
        const category = await createCategory({ deleted_at: new Date() });

        const response = await request(app)
          .delete(`${ADMIN_BASE_URL}/${category.public_id}`)
          .set(csrfHeaders(cookie!, csrf!))

        expect(response.status).toBe(404);
      });
    });

    describe("PUT /api/v1/admin/categories/:category_public_id/products/:product_public_id", () => {
      it("assigns a product to the category (204)", async () => {
        const { cookie, csrf } = await createAdminUser(app);
        const category = await createCategory({ name: "Headphones" });
        const product = await visibleProduct();

        const response = await request(app)
          .put(`${ADMIN_BASE_URL}/${category.public_id}/products/${product.public_id}`)
          .set(csrfHeaders(cookie!, csrf!))

        expect(response.status).toBe(204);

        const productsResponse = await request(app).get(
          `${PUBLIC_BASE_URL}/${category.public_id}/products`,
        );
        expect(productsResponse.body.data.map((p: { public_id: string }) => p.public_id)).toContain(
          product.public_id,
        );
      });

      it("is idempotent when the product is already assigned (204)", async () => {
        const { cookie, csrf } = await createAdminUser(app);
        const category = await createCategory({ name: "Headphones" });
        const product = await createProduct();

        await request(app)
          .put(`${ADMIN_BASE_URL}/${category.public_id}/products/${product.public_id}`)
          .set(csrfHeaders(cookie!, csrf!))
        const response = await request(app)
          .put(`${ADMIN_BASE_URL}/${category.public_id}/products/${product.public_id}`)
          .set(csrfHeaders(cookie!, csrf!))

        expect(response.status).toBe(204);
      });

      it("returns 404 for an unknown product", async () => {
        const { cookie, csrf } = await createAdminUser(app);
        const category = await createCategory({ name: "Headphones" });

        const response = await request(app)
          .put(`${ADMIN_BASE_URL}/${category.public_id}/products/prd_${nanoid(10)}`)
          .set(csrfHeaders(cookie!, csrf!))

        expect(response.status).toBe(404);
      });
    });

    describe("DELETE /api/v1/admin/categories/:category_public_id/products/:product_public_id", () => {
      it("unassigns a product from the category (204)", async () => {
        const { cookie, csrf } = await createAdminUser(app);
        const category = await createCategory({ name: "Headphones" });
        const product = await createProduct();
        await createCategoryProductLink(category.id, product.id);

        const response = await request(app)
          .delete(`${ADMIN_BASE_URL}/${category.public_id}/products/${product.public_id}`)
          .set(csrfHeaders(cookie!, csrf!))

        expect(response.status).toBe(204);

        const productsResponse = await request(app).get(
          `${PUBLIC_BASE_URL}/${category.public_id}/products`,
        );
        expect(productsResponse.body.data).toEqual([]);
      });

      it("is idempotent when the link does not exist (204)", async () => {
        const { cookie, csrf } = await createAdminUser(app);
        const category = await createCategory({ name: "Headphones" });
        const product = await createProduct();

        const response = await request(app)
          .delete(`${ADMIN_BASE_URL}/${category.public_id}/products/${product.public_id}`)
          .set(csrfHeaders(cookie!, csrf!))

        expect(response.status).toBe(204);
      });

      it("returns 404 for an unknown category", async () => {
        const { cookie, csrf } = await createAdminUser(app);
        const product = await createProduct();

        const response = await request(app)
          .delete(`${ADMIN_BASE_URL}/cat_${nanoid(10)}/products/${product.public_id}`)
          .set(csrfHeaders(cookie!, csrf!))

        expect(response.status).toBe(404);
      });
    });
  });
});
