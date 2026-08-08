import { describe, it, expect } from "vitest";
import { verifyEmailSchema } from "../../../src/modules/auth/validators/verifyEmail.js";

describe("verifyEmailSchema", () => {
  it("accepts a token", () => {
    const result = verifyEmailSchema.safeParse({ body: { token: "abc123" } });
    expect(result.success).toBe(true);
  });

  it("accepts a whitespace-trimmed token", () => {
    const result = verifyEmailSchema.safeParse({ body: { token: "  abc  " } });
    expect(result.success).toBe(true);
  });

  it("rejects a missing token", () => {
    const result = verifyEmailSchema.safeParse({ body: {} });
    expect(result.success).toBe(false);
  });

  it("rejects a blank token", () => {
    const result = verifyEmailSchema.safeParse({ body: { token: "   " } });
    expect(result.success).toBe(false);
  });
});
