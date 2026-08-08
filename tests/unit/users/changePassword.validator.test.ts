import { describe, it, expect } from "vitest";
import { changePasswordSchema } from "../../../src/modules/users/validators/changePassword.js";

const validBody = {
  current_password: "CurrentPassword123!",
  new_password: "NewStrongPassword456!",
};

describe("changePasswordSchema", () => {
  it("accepts a valid payload", () => {
    const result = changePasswordSchema.safeParse({ body: validBody });
    expect(result.success).toBe(true);
  });

  it("rejects a missing current_password", () => {
    const { current_password, ...body } = validBody;
    const result = changePasswordSchema.safeParse({ body });
    expect(result.success).toBe(false);
  });

  it("rejects a weak new_password", () => {
    const result = changePasswordSchema.safeParse({
      body: { ...validBody, new_password: "short" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a new_password without a special character", () => {
    const result = changePasswordSchema.safeParse({
      body: { ...validBody, new_password: "NoSpecialCharacter1" },
    });
    expect(result.success).toBe(false);
  });
});
