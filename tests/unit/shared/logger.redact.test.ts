import { describe, expect, it } from "vitest";
import { stripUrlQuery } from "../../../src/shared/logger/redact.js";

// Seeded credential used to prove no raw token survives logging.
const SEEDED_TOKEN = "test-token-abc123secret";

describe("stripUrlQuery", () => {
  it("removes a token query parameter", () => {
    const result = stripUrlQuery(`/verify-email?token=${SEEDED_TOKEN}`);
    expect(result).toBe("/verify-email");
    expect(result).not.toContain(SEEDED_TOKEN);
  });

  it("removes every query parameter, including sensitive keys", () => {
    const url = `/reset-password?token=${SEEDED_TOKEN}&otp=998877&email=x@y.z`;
    const result = stripUrlQuery(url);
    expect(result).toBe("/reset-password");
    expect(result).not.toContain(SEEDED_TOKEN);
    expect(result).not.toContain("998877");
  });

  it("leaves paths without a query string untouched", () => {
    expect(stripUrlQuery("/api/v1/products?page=1&limit=8".split("?")[0])).toBe(
      "/api/v1/products",
    );
    expect(stripUrlQuery("/health")).toBe("/health");
  });

  it("handles an empty query string", () => {
    expect(stripUrlQuery("/api/v1/cart?")).toBe("/api/v1/cart");
  });

  it("handles absolute URLs by stripping from the first question mark", () => {
    const result = stripUrlQuery(
      `https://shop.example/verify-email?token=${SEEDED_TOKEN}`,
    );
    expect(result).toBe("https://shop.example/verify-email");
    expect(result).not.toContain(SEEDED_TOKEN);
  });
});
