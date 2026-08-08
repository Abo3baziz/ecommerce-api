import { describe, it, expect } from "vitest";
import { registerSchema } from "../../../src/modules/auth/validators/register.js";

const validBody = {
  first_name: "Ahmed",
  last_name: "Aziz",
  phone_number: "+201234567890",
  email: "ahmed@example.com",
  password: "StrongPassword123!",
};

describe("registerSchema", () => {
  it("accepts a valid registration payload", () => {
    const result = registerSchema.safeParse({ body: validBody });
    expect(result.success).toBe(true);
  });

  it("rejects a missing first_name", () => {
    const { first_name, ...body } = validBody;
    const result = registerSchema.safeParse({ body });
    expect(result.success).toBe(false);
  });

  it("rejects a blank first_name after trimming", () => {
    const result = registerSchema.safeParse({
      body: { ...validBody, first_name: "   " },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a phone number that is not E.164", () => {
    const result = registerSchema.safeParse({
      body: { ...validBody, phone_number: "01234567890" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = registerSchema.safeParse({
      body: { ...validBody, email: "not-an-email" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password that violates the policy", () => {
    const result = registerSchema.safeParse({
      body: { ...validBody, password: "weakpass" },
    });
    expect(result.success).toBe(false);
  });
});
