import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { nanoid } from "nanoid";
import { app } from "../../../src/app/index.js";
import { createAdminUser, registerUser, csrfHeaders } from "../../helpers/auth.js";
import { cleanupTestData } from "../../helpers/db.js";
import { createProduct } from "../../factories/product.factory.js";
import { createVariant } from "../../factories/variant.factory.js";
import { createInventory } from "../../factories/inventory.factory.js";

const ADMIN_BASE_URL = "/api/v1/admin/inventory";

function createInventoryPayload(overrides: Record<string, unknown> = {}) {
  return {
    variant_public_id: `var_${nanoid(10)}`,
    quantity_on_hand: 100,
    reorder_level: 20,
    ...overrides,
  };
}

describe("inventory API", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

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

  describe("GET /api/v1/admin/inventory", () => {
    it("returns an empty list with pagination metadata (200)", async () => {
      const { cookie, csrf } = await createAdminUser(app);

      const response = await request(app)
        .get(ADMIN_BASE_URL)
        .set("Cookie", cookie!);

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

    it("lists inventory with derived fields and no internal ids (200)", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct({ name: "Wireless Headphones" });
      const variant = await createVariant(product.id, { sku: "WH-1000" });
      await createInventory(variant.id, { quantity_on_hand: 100, quantity_reserved: 5 });

      const response = await request(app)
        .get(ADMIN_BASE_URL)
        .set("Cookie", cookie!);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      const item = response.body.data[0];
      expect(item.public_id).toBe(variant.public_id);
      expect(item.product_name).toBe("Wireless Headphones");
      expect(item.quantity_available).toBe(95);
      expect(item.quantity_reserved).toBe(5);
      expect(item.stock_status).toBe("IN_STOCK");
      expect(item).not.toHaveProperty("id");
      expect(item).not.toHaveProperty("product_variants_id");
      expect(item).not.toHaveProperty("deleted_at");
    });

    it("excludes soft-deleted variants by default and includes them when requested (200)", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct();
      const deletedVariant = await createVariant(product.id, { deleted_at: new Date() });
      await createInventory(deletedVariant.id);

      const defaultResponse = await request(app)
        .get(ADMIN_BASE_URL)
        .set("Cookie", cookie!);
      expect(defaultResponse.body.data).toHaveLength(0);

      const includeDeletedResponse = await request(app)
        .get(`${ADMIN_BASE_URL}?include_deleted=true`)
        .set("Cookie", cookie!);
      expect(includeDeletedResponse.body.data).toHaveLength(1);
      expect(includeDeletedResponse.body.data[0].public_id).toBe(deletedVariant.public_id);
    });

    it("filters by stock_status (200)", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct();
      const out = await createVariant(product.id, { sku: "OUT-1" });
      const low = await createVariant(product.id, { sku: "LOW-1" });
      await createInventory(out.id, { quantity_on_hand: 0 });
      await createInventory(low.id, { quantity_on_hand: 15, reorder_level: 20 });

      const response = await request(app)
        .get(`${ADMIN_BASE_URL}?stock_status=LOW_STOCK`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(200);
      expect(response.body.data.map((i: { public_id: string }) => i.public_id)).toEqual([
        low.public_id,
      ]);
    });

    it("searches by sku (200)", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id, { sku: "WH-1000XM5" });
      await createInventory(variant.id);

      const response = await request(app)
        .get(`${ADMIN_BASE_URL}?search=wh-1000`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(200);
      expect(response.body.data.map((i: { public_id: string }) => i.public_id)).toEqual([
        variant.public_id,
      ]);
    });

    it("rejects an invalid sort field (400)", async () => {
      const { cookie, csrf } = await createAdminUser(app);

      const response = await request(app)
        .get(`${ADMIN_BASE_URL}?sort=price`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("rejects an invalid stock_status (400)", async () => {
      const { cookie, csrf } = await createAdminUser(app);

      const response = await request(app)
        .get(`${ADMIN_BASE_URL}?stock_status=SOLD_OUT`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/v1/admin/inventory", () => {
    it("creates inventory for a variant (201)", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct({ name: "Wireless Headphones" });
      const variant = await createVariant(product.id, { sku: "WH-1000" });

      const response = await request(app)
        .post(ADMIN_BASE_URL)
        .set(csrfHeaders(cookie!, csrf!))
        .send(createInventoryPayload({ variant_public_id: variant.public_id }));

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.public_id).toBe(variant.public_id);
      expect(response.body.data.quantity_on_hand).toBe(100);
      expect(response.body.data.quantity_reserved).toBe(0);
      expect(response.body.data.quantity_available).toBe(100);
      expect(response.body.data.reorder_level).toBe(20);
      expect(response.body.data).not.toHaveProperty("id");
    });

    it("returns 404 for an unknown variant", async () => {
      const { cookie, csrf } = await createAdminUser(app);

      const response = await request(app)
        .post(ADMIN_BASE_URL)
        .set(csrfHeaders(cookie!, csrf!))
        .send(createInventoryPayload());

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it("returns 404 for a soft-deleted variant", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id, { deleted_at: new Date() });

      const response = await request(app)
        .post(ADMIN_BASE_URL)
        .set(csrfHeaders(cookie!, csrf!))
        .send(createInventoryPayload({ variant_public_id: variant.public_id }));

      expect(response.status).toBe(404);
    });

    it("returns 409 when inventory already exists for the variant", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);
      await createInventory(variant.id);

      const response = await request(app)
        .post(ADMIN_BASE_URL)
        .set(csrfHeaders(cookie!, csrf!))
        .send(createInventoryPayload({ variant_public_id: variant.public_id }));

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    it("rejects a negative quantity_on_hand (400)", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);

      const response = await request(app)
        .post(ADMIN_BASE_URL)
        .set(csrfHeaders(cookie!, csrf!))
        .send(createInventoryPayload({ variant_public_id: variant.public_id, quantity_on_hand: -1 }));

      expect(response.status).toBe(400);
    });

    it("rejects a missing variant_public_id (400)", async () => {
      const { cookie, csrf } = await createAdminUser(app);

      const response = await request(app)
        .post(ADMIN_BASE_URL)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ quantity_on_hand: 10 });

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/v1/admin/inventory/:variant_public_id", () => {
    it("returns the inventory object (200)", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct({ name: "Wireless Headphones" });
      const variant = await createVariant(product.id, { sku: "WH-1000" });
      await createInventory(variant.id, { quantity_on_hand: 100, quantity_reserved: 5, reorder_level: 20 });

      const response = await request(app)
        .get(`${ADMIN_BASE_URL}/${variant.public_id}`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.public_id).toBe(variant.public_id);
      expect(response.body.data.quantity_available).toBe(95);
      expect(response.body.data.stock_status).toBe("IN_STOCK");
      expect(response.body.data).not.toHaveProperty("id");
      expect(response.body.data).not.toHaveProperty("deleted_at");
    });

    it("returns 404 for a variant without an inventory record", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);

      const response = await request(app)
        .get(`${ADMIN_BASE_URL}/${variant.public_id}`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it("returns 404 for an unknown variant", async () => {
      const { cookie, csrf } = await createAdminUser(app);

      const response = await request(app)
        .get(`${ADMIN_BASE_URL}/var_${nanoid(10)}`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(404);
    });

    it("returns 404 for a soft-deleted variant", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id, { deleted_at: new Date() });
      await createInventory(variant.id);

      const response = await request(app)
        .get(`${ADMIN_BASE_URL}/${variant.public_id}`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(404);
    });
  });

  describe("PATCH /api/v1/admin/inventory/:variant_public_id", () => {
    it("sets an absolute quantity_on_hand (200)", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);
      await createInventory(variant.id, { quantity_on_hand: 100 });

      const response = await request(app)
        .patch(`${ADMIN_BASE_URL}/${variant.public_id}`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ quantity_on_hand: 75, reason: "Stocktake correction" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.quantity_on_hand).toBe(75);
      expect(response.body.data.quantity_available).toBe(75);
    });

    it("applies a quantity_change delta (200)", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);
      await createInventory(variant.id, { quantity_on_hand: 10 });

      const response = await request(app)
        .patch(`${ADMIN_BASE_URL}/${variant.public_id}`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ quantity_change: 25 });

      expect(response.status).toBe(200);
      expect(response.body.data.quantity_on_hand).toBe(35);
    });

    it("returns 409 when a delta would drive stock below zero", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);
      await createInventory(variant.id, { quantity_on_hand: 10 });

      const response = await request(app)
        .patch(`${ADMIN_BASE_URL}/${variant.public_id}`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ quantity_change: -15 });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    it("returns 400 for an empty body", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);
      await createInventory(variant.id);

      const response = await request(app)
        .patch(`${ADMIN_BASE_URL}/${variant.public_id}`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({});

      expect(response.status).toBe(400);
    });

    it("returns 400 when both quantity fields are sent", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);
      await createInventory(variant.id);

      const response = await request(app)
        .patch(`${ADMIN_BASE_URL}/${variant.public_id}`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ quantity_on_hand: 50, quantity_change: 10 });

      expect(response.status).toBe(400);
    });

    it("returns 400 for a zero quantity_change", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);
      await createInventory(variant.id);

      const response = await request(app)
        .patch(`${ADMIN_BASE_URL}/${variant.public_id}`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ quantity_change: 0 });

      expect(response.status).toBe(400);
    });

    it("clears reorder_level with null (200)", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);
      await createInventory(variant.id, { reorder_level: 20 });

      const response = await request(app)
        .patch(`${ADMIN_BASE_URL}/${variant.public_id}`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ reorder_level: null });

      expect(response.status).toBe(200);
      expect(response.body.data.reorder_level).toBeNull();
    });

    it("returns 404 for a variant without an inventory record", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);

      const response = await request(app)
        .patch(`${ADMIN_BASE_URL}/${variant.public_id}`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ quantity_change: 5 });

      expect(response.status).toBe(404);
    });
  });
});
