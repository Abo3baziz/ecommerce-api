import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { nanoid } from "nanoid";
import { app } from "../../../src/app/index.js";
import {
  createAdminUser,
  createSuperAdminUser,
  registerUser,
  csrfHeaders,
} from "../../helpers/auth.js";
import type { CsrfPair } from "../../helpers/auth.js";
import { cleanupTestData } from "../../helpers/db.js";
import { createProduct } from "../../factories/product.factory.js";
import { createVariant } from "../../factories/variant.factory.js";
import { createInventory } from "../../factories/inventory.factory.js";
import { createCoupon } from "../../factories/coupon.factory.js";
import { discount_type } from "../../../src/generated/prisma/enums.js";

const ORDERS_URL = "/api/v1/orders";
const ADMIN_ORDERS_URL = "/api/v1/admin/orders";
const CART_ITEMS_URL = "/api/v1/cart/items";
const ADDRESS_URL = "/api/v1/users/me/addresses";

function validAddressPayload() {
  return {
    recipient_name: "Test Recipient",
    phone_number: "+15550000000",
    country: "Egypt",
    state: "Cairo",
    city: "Cairo",
    address_1: "12 Test Street",
    zip_code: "12345",
  };
}

async function createCatalog(overrides: {
  stock?: number;
  price?: string;
  quantity?: number;
} = {}) {
  const product = await createProduct();
  const variant = await createVariant(product.id, {
    sku: `SKU-${nanoid(8)}`,
    price: overrides.price ?? "100.00",
    discount_percentage: "0.00",
  });
  await createInventory(variant.id, {
    quantity_on_hand: overrides.stock ?? 100,
  });
  return { product, variant };
}

async function addToCart(
  cookie: string,
  csrf: CsrfPair,
  variantPublicId: string,
  quantity = 1,
) {
  return request(app)
    .post(CART_ITEMS_URL)
    .set(csrfHeaders(cookie, csrf))
    .send({ variant_public_id: variantPublicId, quantity });
}

async function createAddress(cookie: string, csrf: CsrfPair) {
  const response = await request(app)
    .post(ADDRESS_URL)
    .set(csrfHeaders(cookie, csrf))
    .send(validAddressPayload());
  return response;
}

async function placeOrder(
  cookie: string,
  csrf: CsrfPair,
  addressPublicId: string,
  body: Record<string, unknown> = {},
) {
  return request(app)
    .post(ORDERS_URL)
    .set(csrfHeaders(cookie, csrf))
    .send({ address_public_id: addressPublicId, payment_method: "mock", ...body });
}

async function createReadyOrder(
  cookie: string,
  csrf: CsrfPair,
  overrides: { quantity?: number; stock?: number } = {},
) {
  const { variant } = await createCatalog(overrides);
  await addToCart(cookie, csrf, variant.public_id, overrides.quantity ?? 1);
  const addressResponse = await createAddress(cookie, csrf);
  const orderResponse = await placeOrder(
    cookie,
    csrf,
    addressResponse.body.data.public_id,
  );
  return { variant, address: addressResponse, order: orderResponse };
}

describe("orders API", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("authentication", () => {
    it("returns 401 without a session for every endpoint", async () => {
      const { variant } = await createCatalog();

      const postResponse = await request(app).post(ORDERS_URL);
      const listResponse = await request(app).get(ORDERS_URL);
      const getResponse = await request(app).get(
        `${ORDERS_URL}/${variant.public_id}`,
      );
      const adminListResponse = await request(app).get(ADMIN_ORDERS_URL);
      const adminGetResponse = await request(app).get(
        `${ADMIN_ORDERS_URL}/${variant.public_id}`,
      );
      const adminPatchResponse = await request(app).patch(
        `${ADMIN_ORDERS_URL}/${variant.public_id}`,
      );

      expect(postResponse.status).toBe(401);
      expect(listResponse.status).toBe(401);
      expect(getResponse.status).toBe(401);
      expect(adminListResponse.status).toBe(401);
      expect(adminGetResponse.status).toBe(401);
      expect(adminPatchResponse.status).toBe(401);
    });
  });

  describe("POST /api/v1/orders", () => {
    it("places an order and returns the confirmed projection (201)", async () => {
      const { cookie, csrf } = await registerUser(app);
      const { variant } = await createCatalog();

      await addToCart(cookie!, csrf!, variant.public_id, 2);
      const addressResponse = await createAddress(cookie!, csrf!);
      const response = await placeOrder(cookie!, csrf!, addressResponse.body.data.public_id);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      const order = response.body.data;
      expect(order.public_id).toMatch(/^ord_/);
      expect(order.order_number).toMatch(/^ORD-\d{8}$/);
      expect(order.status).toBe("confirmed");
      expect(order.subtotal).toBe("200.00");
      expect(order.shipping_fee).toBe("10.00");
      expect(order.total_amount).toBe("210.00");
      expect(order.shipping_address.recipient_name).toBe("Test Recipient");
      expect(order.shipping_address.postal_code).toBe("12345");
      expect(order.payment.status).toBe("paid");
      expect(order.payment.method).toBe("mock");
      expect(order.payment.provider).toBe("mock");
      expect(order.payment.transaction_reference).toMatch(/^mock_/);
      expect(order.items).toHaveLength(1);
      expect(order.items[0].variant_public_id).toBe(variant.public_id);
      expect(order.items[0].unit_price).toBe("100.00");
      expect(order).not.toHaveProperty("id");
      expect(order).not.toHaveProperty("users_id");
      expect(order.items[0]).not.toHaveProperty("orders_id");
      expect(order.items[0]).not.toHaveProperty("product_variants_id");
    });

    it("echoes notes on the created order (201)", async () => {
      const { cookie, csrf } = await registerUser(app);
      const { variant } = await createCatalog();
      await addToCart(cookie!, csrf!, variant.public_id);
      const addressResponse = await createAddress(cookie!, csrf!);

      const response = await placeOrder(cookie!, csrf!, addressResponse.body.data.public_id, {
        notes: "Leave at the front door",
      });

      expect(response.status).toBe(201);
      expect(response.body.data.notes).toBe("Leave at the front door");
    });

    it("applies a valid coupon (201)", async () => {
      const { cookie, csrf } = await registerUser(app);
      const { variant } = await createCatalog();
      await addToCart(cookie!, csrf!, variant.public_id, 2);
      const coupon = await createCoupon({
        code: `E2E-${nanoid(8)}`,
        discount_type: discount_type.FIXED_AMOUNT,
        discount_value: "25.00",
      });
      const addressResponse = await createAddress(cookie!, csrf!);

      const response = await placeOrder(cookie!, csrf!, addressResponse.body.data.public_id, {
        coupon_code: coupon.code,
      });

      expect(response.status).toBe(201);
      expect(response.body.data.discount_amount).toBe("25.00");
      expect(response.body.data.total_amount).toBe("185.00");
    });

    it("returns 400 for an unsupported payment_method", async () => {
      const { cookie, csrf } = await registerUser(app);
      await createCatalog();
      const addressResponse = await createAddress(cookie!, csrf!);

      const response = await request(app)
        .post(ORDERS_URL)
        .set(csrfHeaders(cookie!, csrf!))
        .send({
          address_public_id: addressResponse.body.data.public_id,
          payment_method: "stripe",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("returns 400 for a missing address_public_id", async () => {
      const { cookie, csrf } = await registerUser(app);
      await createCatalog();

      const response = await request(app)
        .post(ORDERS_URL)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ payment_method: "mock" });

      expect(response.status).toBe(400);
    });

    it("returns 404 for an unknown address", async () => {
      const { cookie, csrf } = await registerUser(app);
      await createCatalog();
      await addToCart(cookie!, csrf!, (await createCatalog()).variant.public_id);

      const response = await placeOrder(cookie!, csrf!, `adr_${nanoid(10)}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it("returns 409 for an empty cart", async () => {
      const { cookie, csrf } = await registerUser(app);
      const { variant } = await createCatalog();
      await addToCart(cookie!, csrf!, variant.public_id);
      await request(app)
        .delete(`${CART_ITEMS_URL}/${variant.public_id}`)
        .set(csrfHeaders(cookie!, csrf!))
      const addressResponse = await createAddress(cookie!, csrf!);

      const response = await placeOrder(cookie!, csrf!, addressResponse.body.data.public_id);

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    it("returns 409 for insufficient stock", async () => {
      const { cookie, csrf } = await registerUser(app);
      await createCatalog({ stock: 1 });
      const addressResponse = await createAddress(cookie!, csrf!);
      const { variant } = await createCatalog({ stock: 1 });
      await addToCart(cookie!, csrf!, variant.public_id, 2);

      const response = await placeOrder(cookie!, csrf!, addressResponse.body.data.public_id);

      expect(response.status).toBe(409);
    });

    it("returns 409 for an invalid coupon code", async () => {
      const { cookie, csrf } = await registerUser(app);
      const { variant } = await createCatalog();
      await addToCart(cookie!, csrf!, variant.public_id);
      const addressResponse = await createAddress(cookie!, csrf!);

      const response = await placeOrder(cookie!, csrf!, addressResponse.body.data.public_id, {
        coupon_code: "NOT-A-COUPON",
      });

      expect(response.status).toBe(409);
    });
  });

  describe("coupon quota restore on cancellation", () => {
    it("reuses the coupon after an admin cancels the order", async () => {
      const { cookie, csrf } = await registerUser(app);
      const { variant } = await createCatalog();
      await addToCart(cookie!, csrf!, variant.public_id, 2);
      const coupon = await createCoupon({
        code: `E2E-RESTORE-${nanoid(8)}`,
        discount_type: discount_type.FIXED_AMOUNT,
        discount_value: "25.00",
        usage_limit: 1,
      });
      const addressResponse = await createAddress(cookie!, csrf!);

      const firstOrder = await placeOrder(
        cookie!,
        csrf!,
        addressResponse.body.data.public_id,
        { coupon_code: coupon.code },
      );
      expect(firstOrder.status).toBe(201);
      expect(firstOrder.body.data.discount_amount).toBe("25.00");

      const admin = await createAdminUser(app);
      const cancelled = await request(app)
        .patch(`${ADMIN_ORDERS_URL}/${firstOrder.body.data.public_id}`)
        .set(csrfHeaders(admin.cookie!, admin.csrf!))
        .send({ status: "cancelled" });
      expect(cancelled.status).toBe(200);
      expect(cancelled.body.data.status).toBe("cancelled");

      await addToCart(cookie!, csrf!, variant.public_id, 2);
      const secondOrder = await placeOrder(
        cookie!,
        csrf!,
        addressResponse.body.data.public_id,
        { coupon_code: coupon.code },
      );
      expect(secondOrder.status).toBe(201);
      expect(secondOrder.body.data.discount_amount).toBe("25.00");
    });
  });

  describe("GET /api/v1/orders", () => {
    it("returns an empty history for a new user (200)", async () => {
      const { cookie, csrf } = await registerUser(app);

      const response = await request(app).get(ORDERS_URL).set("Cookie", cookie!);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
      expect(response.body.pagination.total).toBe(0);
    });

    it("returns the user's orders", async () => {
      const { cookie, csrf } = await registerUser(app);
      const { order } = await createReadyOrder(cookie!, csrf!);

      const response = await request(app).get(ORDERS_URL).set("Cookie", cookie!);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].public_id).toBe(order.body.data.public_id);
      expect(response.body.pagination.total).toBe(1);
    });

    it("filters by status", async () => {
      const { cookie, csrf } = await registerUser(app);
      await createReadyOrder(cookie!, csrf!);

      const confirmed = await request(app)
        .get(`${ORDERS_URL}?status=confirmed`)
        .set("Cookie", cookie!);
      const pending = await request(app)
        .get(`${ORDERS_URL}?status=pending`)
        .set("Cookie", cookie!);

      expect(confirmed.body.data).toHaveLength(1);
      expect(pending.body.data).toHaveLength(0);
    });

    it("returns 400 for an invalid sort field", async () => {
      const { cookie, csrf } = await registerUser(app);

      const response = await request(app)
        .get(`${ORDERS_URL}?sort=customer_name`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(400);
    });

    it("returns 400 for an invalid status", async () => {
      const { cookie, csrf } = await registerUser(app);

      const response = await request(app)
        .get(`${ORDERS_URL}?status=paid`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/v1/orders/:order_public_id", () => {
    it("returns the requesting user's order (200)", async () => {
      const { cookie, csrf } = await registerUser(app);
      const { order } = await createReadyOrder(cookie!, csrf!);

      const response = await request(app)
        .get(`${ORDERS_URL}/${order.body.data.public_id}`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(200);
      expect(response.body.data.public_id).toBe(order.body.data.public_id);
    });

    it("returns 404 for another user's order", async () => {
      const { cookie, csrf } = await registerUser(app);
      const { order } = await createReadyOrder(cookie!, csrf!);
      const other = await registerUser(app);

      const response = await request(app)
        .get(`${ORDERS_URL}/${order.body.data.public_id}`)
        .set("Cookie", other.cookie!);

      expect(response.status).toBe(404);
    });

    it("returns 404 for an unknown order", async () => {
      const { cookie, csrf } = await registerUser(app);

      const response = await request(app)
        .get(`${ORDERS_URL}/ord_${nanoid(10)}`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(404);
    });
  });

  describe("admin authorization", () => {
    it("returns 403 for a customer on admin endpoints", async () => {
      const { cookie, csrf } = await registerUser(app);
      const { order } = await createReadyOrder(cookie!, csrf!);
      const publicId = order.body.data.public_id;

      const list = await request(app)
        .get(ADMIN_ORDERS_URL)
        .set("Cookie", cookie!);
      const get = await request(app)
        .get(`${ADMIN_ORDERS_URL}/${publicId}`)
        .set("Cookie", cookie!);
      const patch = await request(app)
        .patch(`${ADMIN_ORDERS_URL}/${publicId}`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ status: "processing" });

      expect(list.status).toBe(403);
      expect(get.status).toBe(403);
      expect(patch.status).toBe(403);
    });
  });

  describe("GET /api/v1/admin/orders", () => {
    it("returns admin rows with customer summaries", async () => {
      const customer = await registerUser(app);
      const { order } = await createReadyOrder(customer.cookie!, customer.csrf!);
      const admin = await createAdminUser(app);

      const response = await request(app)
        .get(ADMIN_ORDERS_URL)
        .set("Cookie", admin.cookie!);

      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(1);
      const row = response.body.data[0];
      expect(row.public_id).toBe(order.body.data.public_id);
      expect(row.customer_name).toBe("Ahmed Aziz");
      expect(row.customer_public_id).toMatch(/^usr_/);
      expect(row.total_amount).toBe("110.00");
      expect(row).not.toHaveProperty("items");
      expect(row).not.toHaveProperty("payment");
      expect(row).not.toHaveProperty("shipment");
    });

    it("filters by status and search", async () => {
      const customer = await registerUser(app);
      await createReadyOrder(customer.cookie!, customer.csrf!);
      const admin = await createSuperAdminUser(app);

      const byStatus = await request(app)
        .get(`${ADMIN_ORDERS_URL}?status=confirmed`)
        .set("Cookie", admin.cookie!);
      const bySearch = await request(app)
        .get(`${ADMIN_ORDERS_URL}?search=Aziz`)
        .set("Cookie", admin.cookie!);
      const noMatch = await request(app)
        .get(`${ADMIN_ORDERS_URL}?search=zzzz`)
        .set("Cookie", admin.cookie!);

      expect(byStatus.body.data).toHaveLength(1);
      expect(bySearch.body.data).toHaveLength(1);
      expect(noMatch.body.data).toHaveLength(0);
    });

    it("returns 400 when placed_from is after placed_to", async () => {
      const admin = await createAdminUser(app);

      const response = await request(app)
        .get(
          `${ADMIN_ORDERS_URL}?placed_from=2025-02-01T00:00:00.000Z&placed_to=2025-01-01T00:00:00.000Z`,
        )
        .set("Cookie", admin.cookie!);

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/v1/admin/orders/:order_public_id", () => {
    it("returns the full admin projection", async () => {
      const customer = await registerUser(app);
      const { order } = await createReadyOrder(customer.cookie!, customer.csrf!);
      const admin = await createAdminUser(app);

      const response = await request(app)
        .get(`${ADMIN_ORDERS_URL}/${order.body.data.public_id}`)
        .set("Cookie", admin.cookie!);

      expect(response.status).toBe(200);
      expect(response.body.data.shipment.public_id).toMatch(/^shp_/);
      expect(response.body.data.shipment.status).toBe("pending");
      expect(response.body.data.customer_name).toBe("Ahmed Aziz");
      expect(response.body.data.customer_email).toMatch(/^test-/);
      expect(response.body.data.items).toHaveLength(1);
    });

    it("returns 404 for an unknown order", async () => {
      const admin = await createAdminUser(app);

      const response = await request(app)
        .get(`${ADMIN_ORDERS_URL}/ord_${nanoid(10)}`)
        .set("Cookie", admin.cookie!);

      expect(response.status).toBe(404);
    });
  });

  describe("PATCH /api/v1/admin/orders/:order_public_id", () => {
    it("transitions an order through the lifecycle (200)", async () => {
      const customer = await registerUser(app);
      const { order } = await createReadyOrder(customer.cookie!, customer.csrf!);
      const admin = await createAdminUser(app);
      const publicId = order.body.data.public_id;

      const processing = await request(app)
        .patch(`${ADMIN_ORDERS_URL}/${publicId}`)
        .set(csrfHeaders(admin.cookie!, admin.csrf!))
        .send({ status: "processing" });
      expect(processing.status).toBe(200);
      expect(processing.body.data.status).toBe("processing");

      const shipped = await request(app)
        .patch(`${ADMIN_ORDERS_URL}/${publicId}`)
        .set(csrfHeaders(admin.cookie!, admin.csrf!))
        .send({ status: "shipped", carrier: "DHL", tracking_number: "TRK-1" });
      expect(shipped.status).toBe(200);
      expect(shipped.body.data.status).toBe("shipped");
      expect(shipped.body.data.shipment.status).toBe("shipped");
      expect(shipped.body.data.shipment.carrier).toBe("DHL");
      expect(shipped.body.data.shipment.tracking_number).toBe("TRK-1");

      const delivered = await request(app)
        .patch(`${ADMIN_ORDERS_URL}/${publicId}`)
        .set(csrfHeaders(admin.cookie!, admin.csrf!))
        .send({ status: "delivered" });
      expect(delivered.status).toBe(200);
      expect(delivered.body.data.status).toBe("delivered");
      expect(delivered.body.data.shipment.status).toBe("delivered");
    });

    it("returns 400 when shipping without a carrier", async () => {
      const customer = await registerUser(app);
      const { order } = await createReadyOrder(customer.cookie!, customer.csrf!);
      const admin = await createAdminUser(app);

      const response = await request(app)
        .patch(`${ADMIN_ORDERS_URL}/${order.body.data.public_id}`)
        .set(csrfHeaders(admin.cookie!, admin.csrf!))
        .send({ status: "shipped" });

      expect(response.status).toBe(400);
    });

    it("returns 409 for an illegal transition", async () => {
      const customer = await registerUser(app);
      const { order } = await createReadyOrder(customer.cookie!, customer.csrf!);
      const admin = await createAdminUser(app);

      const response = await request(app)
        .patch(`${ADMIN_ORDERS_URL}/${order.body.data.public_id}`)
        .set(csrfHeaders(admin.cookie!, admin.csrf!))
        .send({ status: "delivered" });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });

    it("returns 409 for an unchanged status", async () => {
      const customer = await registerUser(app);
      const { order } = await createReadyOrder(customer.cookie!, customer.csrf!);
      const admin = await createAdminUser(app);

      const response = await request(app)
        .patch(`${ADMIN_ORDERS_URL}/${order.body.data.public_id}`)
        .set(csrfHeaders(admin.cookie!, admin.csrf!))
        .send({ status: "confirmed" });

      expect(response.status).toBe(409);
    });

    it("returns 400 for an invalid status", async () => {
      const customer = await registerUser(app);
      const { order } = await createReadyOrder(customer.cookie!, customer.csrf!);
      const admin = await createAdminUser(app);

      const response = await request(app)
        .patch(`${ADMIN_ORDERS_URL}/${order.body.data.public_id}`)
        .set(csrfHeaders(admin.cookie!, admin.csrf!))
        .send({ status: "paid" });

      expect(response.status).toBe(400);
    });

    it("returns 404 for an unknown order", async () => {
      const admin = await createAdminUser(app);

      const response = await request(app)
        .patch(`${ADMIN_ORDERS_URL}/ord_${nanoid(10)}`)
        .set(csrfHeaders(admin.cookie!, admin.csrf!))
        .send({ status: "processing" });

      expect(response.status).toBe(404);
    });
  });
});
