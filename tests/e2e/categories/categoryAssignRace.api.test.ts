import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../../src/app/index.js";
import { createAdminUser, csrfHeaders } from "../../helpers/auth.js";
import { cleanupTestData } from "../../helpers/db.js";
import { createCategory } from "../../factories/category.factory.js";
import { createProduct } from "../../factories/product.factory.js";
import { createVariant } from "../../factories/variant.factory.js";

const PUBLIC_BASE_URL = "/api/v1/categories";
const ADMIN_BASE_URL = "/api/v1/admin/categories";

describe("admin categories API concurrency", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  it("keeps concurrent duplicate assigns idempotent (both 204, single link)", async () => {
    const { cookie, csrf } = await createAdminUser(app);
    const headers = csrfHeaders(cookie!, csrf!);
    const category = await createCategory({ name: "Race Category", is_active: true });
    const product = await createProduct({ name: "Race Product" });
    await createVariant(product.id);

    const [first, second] = await Promise.all([
      request(app)
        .put(`${ADMIN_BASE_URL}/${category.public_id}/products/${product.public_id}`)
        .set(headers),
      request(app)
        .put(`${ADMIN_BASE_URL}/${category.public_id}/products/${product.public_id}`)
        .set(headers),
    ]);

    expect(first.status).toBe(204);
    expect(second.status).toBe(204);

    const detail = await request(app).get(`${PUBLIC_BASE_URL}/${category.public_id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.data.product_count).toBe(1);
  });
});
