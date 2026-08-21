import { describe, it, expect } from "vitest";
import request from "supertest";
import { app } from "../../../src/app/index.js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PAGE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../public",
);

describe("reset-password page", () => {
  it("serves the reset-password page with no-store caching", async () => {
    const response = await request(app).get("/reset-password");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
    expect(response.headers["cache-control"]).toBe("no-store");
    const html = response.text;
    expect(html).toContain("Reset your password");
  });

  it("serves the reset-password script", async () => {
    const response = await request(app).get("/reset-password.js");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("javascript");
  });

  it("page assets reference each other and exist on disk", () => {
    const html = readFileSync(path.join(PAGE_DIR, "reset-password.html"), "utf-8");
    expect(html).toContain('./reset-password.js');

    const script = readFileSync(path.join(PAGE_DIR, "reset-password.js"), "utf-8");
    expect(script).toContain("/api/v1/auth/password-reset/verify");
  });
});
