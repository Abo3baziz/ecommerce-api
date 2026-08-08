import { describe, it, expect } from "vitest";
import { verifyEmailChangeSchema } from "../../../src/modules/users/validators/verifyEmailChange.js";

describe("verifyEmailChangeSchema", () => {
  it("accepts a token", () => {
    const result = verifyEmailChangeSchema.safeParse({ body: { token: "abc123" } });
    expect(result.success).toBe(true);
  });

  it("rejects a missing token", () => {
    const result = verifyEmailChangeSchema.safeParse({ body: {} });
    expect(result.success).toBe(false);
  });

  it("rejects a blank token", () => {
    const result = verifyEmailChangeSchema.safeParse({ body: { token: "  " } });
    expect(result.success).toBe(false);
  });
});
