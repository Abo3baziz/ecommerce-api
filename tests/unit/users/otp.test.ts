import { describe, it, expect } from "vitest";
import { generateOtp } from "../../../src/modules/users/utils/otp.js";

describe("generateOtp", () => {
  it("returns a 6-digit string by default", () => {
    expect(generateOtp()).toMatch(/^\d{6}$/);
  });

  it("respects a custom length", () => {
    expect(generateOtp(4)).toMatch(/^\d{4}$/);
  });

  it("returns only numeric digits", () => {
    const otp = generateOtp();
    for (const char of otp) {
      expect(char).toMatch(/^\d$/);
    }
  });
});
