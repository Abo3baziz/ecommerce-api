import { describe, it, expect } from "vitest";
import { sessionParamsSchema } from "../../../src/modules/auth/validators/sessionParams.js";

describe("sessionParamsSchema", () => {
  it("accepts a session public id", () => {
    const result = sessionParamsSchema.safeParse({
      params: { session_public_id: "ses_abc123" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing session_public_id", () => {
    const result = sessionParamsSchema.safeParse({ params: {} });
    expect(result.success).toBe(false);
  });

  it("rejects a blank session_public_id", () => {
    const result = sessionParamsSchema.safeParse({
      params: { session_public_id: "" },
    });
    expect(result.success).toBe(false);
  });
});
