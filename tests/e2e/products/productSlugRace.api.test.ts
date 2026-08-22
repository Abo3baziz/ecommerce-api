import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { customAlphabet } from "nanoid";
import { app } from "../../../src/app/index.js";
import { createAdminUser, csrfHeaders } from "../../helpers/auth.js";
import { cleanupTestData } from "../../helpers/db.js";

const ADMIN_BASE_URL = "/api/v1/admin/products";
const slugSafeId = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 8);

describe("admin products API concurrency", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  it("resolves a duplicate-slug create race with a single 201 and a 409 (never 500)", async () => {
    const { cookie, csrf } = await createAdminUser(app);
    const headers = csrfHeaders(cookie!, csrf!);
    const payload = {
      name: `Race Product ${slugSafeId()}`,
      slug: `race-product-${slugSafeId()}`,
      description: "Created twice concurrently.",
    };

    const [first, second] = await Promise.all([
      request(app).post(ADMIN_BASE_URL).set(headers).send(payload),
      request(app).post(ADMIN_BASE_URL).set(headers).send(payload),
    ]);

    const statuses = [first.status, second.status];

    expect(statuses).not.toContain(500);
    expect(statuses.filter((status) => status === 201)).toHaveLength(1);
    expect(statuses.filter((status) => status === 409)).toHaveLength(1);

    const conflict = [first, second].find((response) => response.status === 409)!;
    expect(conflict.body.success).toBe(false);
    expect(typeof conflict.body.message).toBe("string");
  });
});
