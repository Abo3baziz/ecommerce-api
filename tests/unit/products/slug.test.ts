import { describe, it, expect } from "vitest";
import { slugify } from "../../../src/modules/products/utils/slug.js";
import { parseSort } from "../../../src/modules/products/utils/sort.js";
import { Prisma } from "../../../src/generated/prisma/client.js";
import {
  computeFinalPrice,
  decimalToFixed,
} from "../../../src/modules/products/utils/format.js";

describe("slugify", () => {
  it("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Wireless Noise-Cancelling Headphones")).toBe(
      "wireless-noise-cancelling-headphones",
    );
  });

  it("collapses runs of non-alphanumeric characters into a single hyphen", () => {
    expect(slugify("Hello  World")).toBe("hello-world");
    expect(slugify("A!!B??C")).toBe("a-b-c");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugify("  Hello World  ")).toBe("hello-world");
    expect(slugify("!!!Hello!!!")).toBe("hello");
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

describe("decimalToFixed", () => {
  it("formats a decimal to two places", () => {
    expect(decimalToFixed(new Prisma.Decimal("85.5"))).toBe("85.50");
  });

  it("returns null for a null value", () => {
    expect(decimalToFixed(null)).toBeNull();
  });
});

describe("computeFinalPrice", () => {
  it("returns the price unchanged when there is no discount", () => {
    expect(computeFinalPrice(new Prisma.Decimal("129.99"), null)).toBe("129.99");
    expect(computeFinalPrice(new Prisma.Decimal("129.99"), new Prisma.Decimal("0.00"))).toBe(
      "129.99",
    );
  });

  it("applies the discount percentage rounded to two places", () => {
    expect(
      computeFinalPrice(new Prisma.Decimal("129.99"), new Prisma.Decimal("10.00")),
    ).toBe("116.99");
  });
});
