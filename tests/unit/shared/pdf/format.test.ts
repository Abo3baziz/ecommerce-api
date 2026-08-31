import { describe, it, expect } from "vitest";
import { Prisma } from "../../../../src/generated/prisma/client.js";
import { formatMoney, formatPct, formatDateUTC } from "../../../../src/shared/pdf/format.js";

describe("formatMoney", () => {
  it("formats USD", () => {
    expect(formatMoney("1234.50", "USD")).toBe("$1,234.50");
  });
  it("formats EGP", () => {
    expect(formatMoney("1234.50", "EGP")).toContain("1,234.50");
  });
  it("accepts Prisma.Decimal", () => {
    expect(formatMoney(new Prisma.Decimal("10.00"), "USD")).toBe("$10.00");
  });
  it("formats zero", () => {
    expect(formatMoney("0", "USD")).toBe("$0.00");
  });
  it("formats EUR", () => {
    expect(formatMoney("99.99", "EUR")).toContain("99.99");
  });
  it("formats SAR", () => {
    expect(formatMoney("500", "SAR")).toContain("500.00");
  });
  it("falls back on unknown currency", () => {
    expect(formatMoney("10.00", "XYZ" as never)).toContain("10.00");
  });
});

describe("formatPct", () => {
  it("formats pct with 1 decimal", () => {
    expect(formatPct("12.345")).toBe("12.3%");
  });
  it("formats zero", () => {
    expect(formatPct("0")).toBe("0.0%");
  });
});

describe("formatDateUTC", () => {
  it("slices to YYYY-MM-DD", () => {
    expect(formatDateUTC(new Date("2026-08-15T14:00:00Z"))).toBe("2026-08-15");
  });
});
