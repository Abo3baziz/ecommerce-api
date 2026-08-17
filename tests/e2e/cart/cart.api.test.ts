import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { nanoid } from "nanoid";
import { app } from "../../../src/app/index.js";
import { createAdminUser, registerUser, csrfHeaders } from "../../helpers/auth.js";
import { cleanupTestData } from "../../helpers/db.js";
import { createProduct } from "../../factories/product.factory.js";
import { createVariant } from "../../factories/variant.factory.js";
import { createProductImage } from "../../factories/product-image.factory.js";
import { createVariantImage } from "../../factories/variant-image.factory.js";

const CART_URL = "/api/v1/cart";

describe("cart API", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("authentication", () => {
    it("returns 401 without a session for every endpoint", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);

      const getResponse = await request(app).get(CART_URL);
      const postResponse = await request(app).post(`${CART_URL}/items`);
      const patchResponse = await request(app).patch(
        `${CART_URL}/items/${variant.public_id}`,
      );
      const deleteItemResponse = await request(app).delete(
        `${CART_URL}/items/${variant.public_id}`,
      );
      const deleteCartResponse = await request(app).delete(CART_URL);

      expect(getResponse.status).toBe(401);
      expect(postResponse.status).toBe(401);
      expect(patchResponse.status).toBe(401);
      expect(deleteItemResponse.status).toBe(401);
      expect(deleteCartResponse.status).toBe(401);
    });
  });

  describe("GET /api/v1/cart", () => {
    it("returns 404 when the user has no cart", async () => {
      const { cookie, csrf } = await registerUser(app);

      const response = await request(app)
        .get(CART_URL)
        .set("Cookie", cookie!);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it("returns the full cart with no internal ids (200)", async () => {
      const { cookie, csrf } = await registerUser(app);
      const product = await createProduct({ name: "Wireless Headphones" });
      const variant = await createVariant(product.id, {
        sku: "WH-1000",
        price: "129.99",
        discount_percentage: "10.00",
      });

      await request(app)
        .post(`${CART_URL}/items`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ variant_public_id: variant.public_id, quantity: 3 });

      const response = await request(app)
        .get(CART_URL)
        .set("Cookie", cookie!);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      const cart = response.body.data;
      expect(cart.public_id).toMatch(/^crt_/);
      expect(cart.items_count).toBe(1);
      expect(cart.total_quantity).toBe(3);
      expect(cart.subtotal).toBe("350.97");
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].variant_public_id).toBe(variant.public_id);
      expect(cart.items[0].product_name).toBe("Wireless Headphones");
      expect(cart.items[0].sku).toBe("WH-1000");
      expect(cart.items[0].price).toBe("129.99");
      expect(cart.items[0].discount_percentage).toBe("10.00");
      expect(cart.items[0].final_price).toBe("116.99");
      expect(cart.items[0].quantity).toBe(3);
      expect(cart.items[0].line_total).toBe("350.97");
      expect(cart.items[0].created_at).toBeTruthy();
      expect(cart.items[0].updated_at).toBeTruthy();
      expect(cart).not.toHaveProperty("id");
      expect(cart).not.toHaveProperty("users_id");
      expect(cart.items[0]).not.toHaveProperty("id");
      expect(cart.items[0]).not.toHaveProperty("carts_id");
      expect(cart.items[0]).not.toHaveProperty("product_variants_id");
      expect(cart).not.toHaveProperty("deleted_at");
    });

    it("resolves the variant image over the product primary image", async () => {
      const { cookie, csrf } = await registerUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);
      await createProductImage(product.id, { is_primary: true, image_url: "https://ik.imagekit.io/ecommerceImages/primary.jpg" });
      await createVariantImage(variant.id, { image_url: "https://ik.imagekit.io/ecommerceImages/variant.jpg" });

      await request(app)
        .post(`${CART_URL}/items`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ variant_public_id: variant.public_id });

      const response = await request(app)
        .get(CART_URL)
        .set("Cookie", cookie!);

      expect(response.body.data.items[0].image_url).toBe(
        "https://ik.imagekit.io/ecommerceImages/variant.jpg",
      );
    });

    it("returns 200 with an empty cart after all lines are removed", async () => {
      const { cookie, csrf } = await registerUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);

      await request(app)
        .post(`${CART_URL}/items`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ variant_public_id: variant.public_id });
      await request(app)
        .delete(`${CART_URL}/items/${variant.public_id}`)
        .set(csrfHeaders(cookie!, csrf!))

      const response = await request(app)
        .get(CART_URL)
        .set("Cookie", cookie!);

      expect(response.status).toBe(200);
      expect(response.body.data.items).toEqual([]);
      expect(response.body.data.items_count).toBe(0);
      expect(response.body.data.total_quantity).toBe(0);
      expect(response.body.data.subtotal).toBe("0.00");
    });
  });

  describe("POST /api/v1/cart/items", () => {
    it("creates the cart lazily and returns the full cart (200)", async () => {
      const { cookie, csrf } = await registerUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id, { price: "19.99" });

      const response = await request(app)
        .post(`${CART_URL}/items`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ variant_public_id: variant.public_id, quantity: 2 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.public_id).toMatch(/^crt_/);
      expect(response.body.data.items_count).toBe(1);
      expect(response.body.data.total_quantity).toBe(2);
      expect(response.body.data.subtotal).toBe("39.98");
      expect(response.body.data.items[0].quantity).toBe(2);
    });

    it("defaults quantity to 1 when omitted", async () => {
      const { cookie, csrf } = await registerUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);

      const response = await request(app)
        .post(`${CART_URL}/items`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ variant_public_id: variant.public_id });

      expect(response.status).toBe(200);
      expect(response.body.data.items[0].quantity).toBe(1);
    });

    it("increments an existing line instead of duplicating it (200)", async () => {
      const { cookie, csrf } = await registerUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id, { price: "10.00" });

      await request(app)
        .post(`${CART_URL}/items`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ variant_public_id: variant.public_id, quantity: 2 });

      const response = await request(app)
        .post(`${CART_URL}/items`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ variant_public_id: variant.public_id, quantity: 3 });

      expect(response.status).toBe(200);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].quantity).toBe(5);
      expect(response.body.data.subtotal).toBe("50.00");
    });

    it("returns 404 for an unknown variant", async () => {
      const { cookie, csrf } = await registerUser(app);

      const response = await request(app)
        .post(`${CART_URL}/items`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ variant_public_id: `var_${nanoid(10)}` });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it("returns 404 for a soft-deleted variant", async () => {
      const { cookie, csrf } = await registerUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id, { deleted_at: new Date() });

      const response = await request(app)
        .post(`${CART_URL}/items`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ variant_public_id: variant.public_id });

      expect(response.status).toBe(404);
    });

    it("returns 404 for a non-ACTIVE variant", async () => {
      const { cookie, csrf } = await registerUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id, { status: "DRAFT" });

      const response = await request(app)
        .post(`${CART_URL}/items`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ variant_public_id: variant.public_id });

      expect(response.status).toBe(404);
    });

    it("returns 400 for a quantity below 1", async () => {
      const { cookie, csrf } = await registerUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);

      const response = await request(app)
        .post(`${CART_URL}/items`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ variant_public_id: variant.public_id, quantity: 0 });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("returns 400 for a quantity above 999", async () => {
      const { cookie, csrf } = await registerUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);

      const response = await request(app)
        .post(`${CART_URL}/items`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ variant_public_id: variant.public_id, quantity: 1000 });

      expect(response.status).toBe(400);
    });

    it("returns 400 for a missing variant_public_id", async () => {
      const { cookie, csrf } = await registerUser(app);

      const response = await request(app)
        .post(`${CART_URL}/items`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ quantity: 1 });

      expect(response.status).toBe(400);
    });

    it("returns 400 when the merge would exceed the maximum quantity", async () => {
      const { cookie, csrf } = await registerUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);

      await request(app)
        .post(`${CART_URL}/items`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ variant_public_id: variant.public_id, quantity: 999 });

      const response = await request(app)
        .post(`${CART_URL}/items`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ variant_public_id: variant.public_id, quantity: 1 });

      expect(response.status).toBe(400);
    });

    it("works for any authenticated role (admin)", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);

      const response = await request(app)
        .post(`${CART_URL}/items`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ variant_public_id: variant.public_id });

      expect(response.status).toBe(200);
    });
  });

  describe("PATCH /api/v1/cart/items/:variant_public_id", () => {
    it("sets the absolute quantity (200)", async () => {
      const { cookie, csrf } = await registerUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id, { price: "10.00" });

      await request(app)
        .post(`${CART_URL}/items`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ variant_public_id: variant.public_id, quantity: 2 });

      const response = await request(app)
        .patch(`${CART_URL}/items/${variant.public_id}`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ quantity: 4 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.items[0].quantity).toBe(4);
      expect(response.body.data.subtotal).toBe("40.00");
    });

    it("returns 404 when the user has no cart", async () => {
      const { cookie, csrf } = await registerUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);

      const response = await request(app)
        .patch(`${CART_URL}/items/${variant.public_id}`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ quantity: 2 });

      expect(response.status).toBe(404);
    });

    it("returns 404 when the variant is not in the cart", async () => {
      const { cookie, csrf } = await registerUser(app);
      const product = await createProduct();
      const inCart = await createVariant(product.id, { sku: "IN-CART" });
      const other = await createVariant(product.id, { sku: "NOT-IN-CART" });

      await request(app)
        .post(`${CART_URL}/items`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ variant_public_id: inCart.public_id });

      const response = await request(app)
        .patch(`${CART_URL}/items/${other.public_id}`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ quantity: 2 });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it("returns 400 for an invalid quantity", async () => {
      const { cookie, csrf } = await registerUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);

      await request(app)
        .post(`${CART_URL}/items`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ variant_public_id: variant.public_id });

      const response = await request(app)
        .patch(`${CART_URL}/items/${variant.public_id}`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ quantity: 0 });

      expect(response.status).toBe(400);
    });
  });

  describe("DELETE /api/v1/cart/items/:variant_public_id", () => {
    it("removes the line and preserves the cart (204)", async () => {
      const { cookie, csrf } = await registerUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);

      await request(app)
        .post(`${CART_URL}/items`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ variant_public_id: variant.public_id });

      const response = await request(app)
        .delete(`${CART_URL}/items/${variant.public_id}`)
        .set(csrfHeaders(cookie!, csrf!))

      expect(response.status).toBe(204);

      const getResponse = await request(app)
        .get(CART_URL)
        .set("Cookie", cookie!);
      expect(getResponse.status).toBe(200);
      expect(getResponse.body.data.items).toEqual([]);
    });

    it("returns 404 when the user has no cart", async () => {
      const { cookie, csrf } = await registerUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);

      const response = await request(app)
        .delete(`${CART_URL}/items/${variant.public_id}`)
        .set(csrfHeaders(cookie!, csrf!))

      expect(response.status).toBe(404);
    });

    it("returns 404 when the variant is not in the cart", async () => {
      const { cookie, csrf } = await registerUser(app);
      const product = await createProduct();
      const inCart = await createVariant(product.id, { sku: "IN-CART" });
      const other = await createVariant(product.id, { sku: "NOT-IN-CART" });

      await request(app)
        .post(`${CART_URL}/items`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ variant_public_id: inCart.public_id });

      const response = await request(app)
        .delete(`${CART_URL}/items/${other.public_id}`)
        .set(csrfHeaders(cookie!, csrf!))

      expect(response.status).toBe(404);
    });

    it("returns 404 when removing an already-removed line", async () => {
      const { cookie, csrf } = await registerUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);

      await request(app)
        .post(`${CART_URL}/items`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ variant_public_id: variant.public_id });
      await request(app)
        .delete(`${CART_URL}/items/${variant.public_id}`)
        .set(csrfHeaders(cookie!, csrf!))

      const response = await request(app)
        .delete(`${CART_URL}/items/${variant.public_id}`)
        .set(csrfHeaders(cookie!, csrf!))

      expect(response.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/cart", () => {
    it("clears the cart and its lines (204)", async () => {
      const { cookie, csrf } = await registerUser(app);
      const product = await createProduct();
      const variant = await createVariant(product.id);

      await request(app)
        .post(`${CART_URL}/items`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ variant_public_id: variant.public_id });

      const response = await request(app)
        .delete(CART_URL)
        .set(csrfHeaders(cookie!, csrf!))

      expect(response.status).toBe(204);

      const getResponse = await request(app)
        .get(CART_URL)
        .set("Cookie", cookie!);
      expect(getResponse.status).toBe(404);
    });

    it("returns 404 when the user has no cart", async () => {
      const { cookie, csrf } = await registerUser(app);

      const response = await request(app)
        .delete(CART_URL)
        .set(csrfHeaders(cookie!, csrf!))

      expect(response.status).toBe(404);
    });
  });
});
