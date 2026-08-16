import { describe, it, expect } from "vitest";
import {
  requestPasswordResetSchema,
  verifyPasswordResetSchema,
} from "../../../src/modules/auth/validators/passwordReset.js";

describe("requestPasswordResetSchema", () => {
  it("accepts a valid email", () => {
    const result = requestPasswordResetSchema.safeParse({
      body: { email: "ahmed@example.com" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing email", () => {
    const result = requestPasswordResetSchema.safeParse({ body: {} });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = requestPasswordResetSchema.safeParse({
      body: { email: "not-an-email" },
    });
    expect(result.success).toBe(false);
  });
});

describe("verifyPasswordResetSchema", () => {
  it("accepts a token and a strong password", () => {
    const result = verifyPasswordResetSchema.safeParse({
      body: { token: "abc123", new_password: "NewStrongPassword123!" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing token", () => {
    const result = verifyPasswordResetSchema.safeParse({
      body: { new_password: "NewStrongPassword123!" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a blank token", () => {
    const result = verifyPasswordResetSchema.safeParse({
      body: { token: "   ", new_password: "NewStrongPassword123!" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password without an uppercase letter", () => {
    const result = verifyPasswordResetSchema.safeParse({
      body: { token: "abc123", new_password: "newstrongpassword123!" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password without a special character", () => {
    const result = verifyPasswordResetSchema.safeParse({
      body: { token: "abc123", new_password: "NewStrongPassword123" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a short password", () => {
    const result = verifyPasswordResetSchema.safeParse({
      body: { token: "abc123", new_password: "Aa1!" },
    });
    expect(result.success).toBe(false);
  });
});