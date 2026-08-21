import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

// Nothing from src/ may be imported statically in this file: the suite
// re-evaluates src/config/env.ts with tightened limits via vi.stubEnv +
// vi.resetModules so the real mounted login/register limiters can be driven
// to their 429 responses without loosening them for every other suite.

vi.stubEnv("LOGIN_RATE_LIMIT_MAX", "3");
vi.stubEnv("REGISTER_RATE_LIMIT_MAX", "2");

let app: Express;

beforeAll(async () => {
  vi.resetModules();
  const appModule = await import("../../../src/app/index.js");
  app = appModule.app;
});

describe("auth endpoint rate limiting", () => {
  it("returns 429 with standard RateLimit headers when the login limit is exceeded", async () => {
    const email = "test-login-throttle@example.com";

    for (let i = 0; i < 3; i += 1) {
      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({ email, password: "definitely-wrong" });
      expect(response.status).toBe(401);
    }

    const blocked = await request(app)
      .post("/api/v1/auth/login")
      .send({ email, password: "definitely-wrong" });

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      success: false,
      message: "Too many login attempts, please try again later",
    });
    expect(blocked.headers["ratelimit-policy"]).toBeDefined();
    expect(blocked.headers["ratelimit-limit"]).toBeDefined();
    expect(blocked.headers["ratelimit-remaining"]).toBe("0");
    expect(blocked.headers["ratelimit-reset"]).toBeDefined();
  });

  it("counts invalid registration bodies toward the register limit", async () => {
    const payload = { email: "not-an-email" };

    for (let i = 0; i < 2; i += 1) {
      const response = await request(app)
        .post("/api/v1/auth/register")
        .send(payload);
      expect(response.status).toBe(400);
    }

    const blocked = await request(app)
      .post("/api/v1/auth/register")
      .send(payload);

    expect(blocked.status).toBe(429);
    expect(blocked.body).toEqual({
      success: false,
      message: "Too many registration attempts, please try again later",
    });
    expect(blocked.headers["ratelimit-remaining"]).toBe("0");
  });
});
