import { describe, it, expect } from "vitest";
import { slugify } from "../../../src/modules/categories/utils/slug.js";
import { parseSort } from "../../../src/modules/categories/utils/sort.js";

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Wireless Headphones & Earbuds")).toBe(
      "wireless-headphones-earbuds",
    );
  });

  it("collapses runs of non-alphanumeric characters into a single hyphen", () => {
    expect(slugify("Audio  Accessories")).toBe("audio-accessories");
    expect(slugify("A!!B??C")).toBe("a-b-c");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugify("  Headphones  ")).toBe("headphones");
    expect(slugify("!!!Speakers!!!")).toBe("speakers");
  });

  it("returns an empty string for names with no alphanumeric characters", () => {
    expect(slugify("!!! ???")).toBe("");
  });
});

describe("parseSort", () => {
  it("parses an ascending field", () => {
    expect(parseSort("name")).toEqual({ field: "name", direction: "asc" });
  });

  it("parses a descending field", () => {
    expect(parseSort("-created_at")).toEqual({
      field: "created_at",
      direction: "desc",
    });
  });
});
