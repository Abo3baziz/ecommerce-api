import { describe, expect, it } from "vitest";
import { escapeLikePattern } from "../../../src/shared/utils/index.js";

describe("escapeLikePattern", () => {
  it("escapes backslash, percent and underscore", () => {
    expect(escapeLikePattern("a\\b%c_d")).toBe("a\\\\b\\%c\\_d");
  });

  it("leaves plain text untouched", () => {
    expect(escapeLikePattern("ORD-2026-0001")).toBe("ORD-2026-0001");
  });

  it("returns empty string for empty input", () => {
    expect(escapeLikePattern("")).toBe("");
  });
});
