import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../../src/app/index.js";

describe("Health endpoints", () => {
  it("GET /health returns fast liveness status", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok" });
  });

  it("GET /health/ready reports database connectivity", async () => {
    const response = await request(app).get("/health/ready");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: "ok", db: "up" });
  });
});

describe("Unknown API routes", () => {
  it("returns the JSON error envelope for unknown /api paths", async () => {
    const response = await request(app).get("/api/v1/nonexistent");

    expect(response.status).toBe(404);
    expect(response.type).toBe("application/json");
    expect(response.body).toEqual({ success: false, message: "Not found" });
  });

  it("covers unsupported methods on matched prefixes", async () => {
    const response = await request(app).delete("/api/v1/nonexistent/deeper");

    expect(response.status).toBe(404);
    expect(response.type).toBe("application/json");
    expect(response.body.success).toBe(false);
  });
});
