import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { app } from "../../../src/app/index.js";
import { registerUser } from "../../helpers/auth.js";
import { cleanupTestData } from "../../helpers/db.js";

describe("Customer ImageKit upload auth API", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  it("returns 401 without a session", async () => {
    const response = await request(app).get("/api/v1/uploads/imagekit-auth");

    expect(response.status).toBe(401);
  });

  it("returns signed upload authentication parameters for any authenticated user (200)", async () => {
    const { cookie } = await registerUser(app);

    const response = await request(app)
      .get("/api/v1/uploads/imagekit-auth")
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
