import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { nanoid } from "nanoid";
import { app } from "../../../src/app/index.js";
import { validRegisterPayload } from "../../helpers/auth.js";
import { cleanupTestData } from "../../helpers/db.js";

describe("register API concurrency", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  it("resolves a duplicate-email race with a single 201 and never a 500", async () => {
    const payload = validRegisterPayload({
      email: `test-${nanoid(8)}@example.com`,
    });

    const [first, second] = await Promise.all([
      request(app).post("/api/v1/auth/register").send(payload),
      request(app).post("/api/v1/auth/register").send(payload),
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
