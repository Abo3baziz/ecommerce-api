import { describe, it, expect } from "vitest";
import { updateProfileSchema } from "../../../src/modules/users/validators/updateProfile.js";

describe("updateProfileSchema", () => {
  it("accepts a valid payload", () => {
    const result = updateProfileSchema.safeParse({
      body: { first_name: "Ahmed", last_name: "Mohamed" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty body since all fields are optional", () => {
    const result = updateProfileSchema.safeParse({ body: {} });
    expect(result.success).toBe(true);
  });

  it("rejects a blank first_name", () => {
    const result = updateProfileSchema.safeParse({
      body: { first_name: "   " },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a first_name longer than 100 characters", () => {
    const result = updateProfileSchema.safeParse({
      body: { first_name: "a".repeat(101) },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-string first_name", () => {
    const result = updateProfileSchema.safeParse({
      body: { first_name: 123 },
    });
    expect(result.success).toBe(false);
  });
});
