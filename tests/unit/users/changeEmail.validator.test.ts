import { describe, it, expect } from "vitest";
import { changeEmailSchema } from "../../../src/modules/users/validators/changeEmail.js";

const validBody = {
  new_email: "new@example.com",
  password: "StrongPassword123!",
};

describe("changeEmailSchema", () => {
  it("accepts a valid payload", () => {
    const result = changeEmailSchema.safeParse({ body: validBody });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid new_email", () => {
    const result = changeEmailSchema.safeParse({
      body: { ...validBody, new_email: "not-an-email" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing password", () => {
    const { password, ...body } = validBody;
    const result = changeEmailSchema.safeParse({ body });
    expect(result.success).toBe(false);
  });
});
