import { describe, it, expect } from "vitest";
import { loginSchema } from "../../../src/modules/auth/validators/login.js";

const validBody = {
  email: "ahmed@example.com",
  password: "StrongPassword123!",
};

describe("loginSchema", () => {
  it("accepts a valid login payload", () => {
    const result = loginSchema.safeParse({ body: validBody });
    expect(result.success).toBe(true);
  });

  it("rejects a missing email", () => {
    const { email, ...body } = validBody;
    const result = loginSchema.safeParse({ body });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = loginSchema.safeParse({
      body: { ...validBody, email: "nope" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing password", () => {
    const { password, ...body } = validBody;
    const result = loginSchema.safeParse({ body });
    expect(result.success).toBe(false);
  });
});
