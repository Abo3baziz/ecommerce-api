import { describe, it, expect } from "vitest";
import { changePhoneSchema } from "../../../src/modules/users/validators/changePhone.js";

const validBody = {
  new_phone_number: "+201234567890",
  password: "StrongPassword123!",
};

describe("changePhoneSchema", () => {
  it("accepts a valid payload", () => {
    const result = changePhoneSchema.safeParse({ body: validBody });
    expect(result.success).toBe(true);
  });

  it("rejects a phone number that is not E.164", () => {
    const result = changePhoneSchema.safeParse({
      body: { ...validBody, new_phone_number: "01234567890" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing password", () => {
    const { password, ...body } = validBody;
    const result = changePhoneSchema.safeParse({ body });
    expect(result.success).toBe(false);
  });
});
