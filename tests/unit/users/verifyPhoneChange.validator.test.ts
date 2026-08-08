import { describe, it, expect } from "vitest";
import { verifyPhoneChangeSchema } from "../../../src/modules/users/validators/verifyPhoneChange.js";

describe("verifyPhoneChangeSchema", () => {
  it("accepts a 6-digit otp", () => {
    const result = verifyPhoneChangeSchema.safeParse({ body: { otp: "123456" } });
    expect(result.success).toBe(true);
  });

  it("rejects an otp shorter than 6 digits", () => {
    const result = verifyPhoneChangeSchema.safeParse({ body: { otp: "12345" } });
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric otp", () => {
    const result = verifyPhoneChangeSchema.safeParse({ body: { otp: "abcdef" } });
    expect(result.success).toBe(false);
  });

  it("rejects a missing otp", () => {
    const result = verifyPhoneChangeSchema.safeParse({ body: {} });
    expect(result.success).toBe(false);
  });
});
