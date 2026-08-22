import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../../src/app/index.js";
import { registerUser, csrfHeaders } from "../../helpers/auth.js";
import { cleanupTestData } from "../../helpers/db.js";
import { createProduct } from "../../factories/product.factory.js";
import { createVariant } from "../../factories/variant.factory.js";
import { createInventory } from "../../factories/inventory.factory.js";

const CART_URL = "/api/v1/cart";

describe("cart API concurrency", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  it("resolves concurrent duplicate line deletions to one 204 and one 404", async () => {
    const { cookie, csrf } = await registerUser(app);
    const headers = csrfHeaders(cookie!, csrf!);

    const product = await createProduct();
    const variant = await createVariant(product.id);
    await createInventory(variant.id, { quantity_on_hand: 10 });

    const addResponse = await request(app)
      .post(`${CART_URL}/items`)
      .set(headers)
      .send({ variant_public_id: variant.public_id, quantity: 1 });

    expect(addResponse.status).toBe(200);

    const [first, second] = await Promise.all([
      request(app)
        .delete(`${CART_URL}/items/${variant.public_id}`)
        .set(headers),
      request(app)
        .delete(`${CART_URL}/items/${variant.public_id}`)
        .set(headers),
    ]);

    const statuses = [first.status, second.status].sort();

    expect(statuses).not.toContain(500);
    expect(statuses).toEqual([204, 404]);

    const conflict = [first, second].find((response) => response.status === 404)!;
    expect(conflict.body.success).toBe(false);
    expect(conflict.body.message).toBe(
      `Variant ${variant.public_id} is not in the cart`,
    );

    const cartAfter = await request(app).get(CART_URL).set("Cookie", cookie!);
    expect(cartAfter.status).toBe(200);
    expect(cartAfter.body.data.items_count).toBe(0);
  });
});
