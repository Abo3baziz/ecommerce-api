import { describe, it, expect } from "vitest";
import {
  generateOpaqueToken,
  hashToken,
} from "../../../src/modules/auth/utils/tokens.js";

describe("generateOpaqueToken", () => {
  it("returns a 64-character hex string", () => {
    const token = generateOpaqueToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns unique values", () => {
    expect(generateOpaqueToken()).not.toBe(generateOpaqueToken());
  });
});

describe("hashToken", () => {
  it("is deterministic for the same token", () => {
    const token = generateOpaqueToken();
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it("produces a 64-character hex hash", () => {
    expect(hashToken("anything")).toMatch(/^[0-9a-f]{64}$/);
  });
});
