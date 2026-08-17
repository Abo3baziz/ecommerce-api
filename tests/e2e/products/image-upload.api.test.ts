import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../../src/app/index.js";
import { createAdminUser, registerUser } from "../../helpers/auth.js";
import { cleanupTestData } from "../../helpers/db.js";

describe("ImageKit upload auth API", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("authentication and authorization", () => {
    it("returns 401 without a session", async () => {
      const response = await request(app).get(
        "/api/v1/admin/products/uploads/imagekit-auth",
      );

      expect(response.status).toBe(401);
    });

    it("returns 403 for a non-admin session", async () => {
      const { cookie, csrf } = await registerUser(app);

      const response = await request(app)
        .get("/api/v1/admin/products/uploads/imagekit-auth")
        .set("Cookie", cookie!);

      expect(response.status).toBe(403);
    });
  });

  describe("GET /api/v1/admin/products/uploads/imagekit-auth", () => {
    it("returns signed upload authentication parameters for an admin (200)", async () => {
      const { cookie, csrf } = await createAdminUser(app);

      const response = await request(app)
        .get("/api/v1/admin/products/uploads/imagekit-auth")
        .set("Cookie", cookie!);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const { token, expire, signature, publicKey, urlEndpoint } = response.body.data;
      expect(typeof token).toBe("string");
      expect(token.length).toBeGreaterThan(0);
      expect(typeof expire).toBe("number");
      expect(expire).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(signature).toMatch(/^[0-9a-f]{40}$/);
      expect(typeof publicKey).toBe("string");
      expect(publicKey.length).toBeGreaterThan(0);
      expect(urlEndpoint).toMatch(/^https:\/\/ik\.imagekit\.io\//);
    });
  });
});
