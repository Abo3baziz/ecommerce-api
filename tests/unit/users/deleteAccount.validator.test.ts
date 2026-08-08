import { describe, it, expect } from "vitest";
import { deleteAccountSchema } from "../../../src/modules/users/validators/deleteAccount.js";

describe("deleteAccountSchema", () => {
  it("accepts a password", () => {
    const result = deleteAccountSchema.safeParse({ body: { password: "secret" } });
    expect(result.success).toBe(true);
  });

  it("rejects a missing password", () => {
    const result = deleteAccountSchema.safeParse({ body: {} });
    expect(result.success).toBe(false);
  });

  it("rejects a blank password", () => {
    const result = deleteAccountSchema.safeParse({ body: { password: "" } });
    expect(result.success).toBe(false);
  });
});
