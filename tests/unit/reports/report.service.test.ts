import { describe, it, expect } from "vitest";
import { resolveReportWindow } from "../../../src/modules/reports/service/report.service.js";

describe("resolveReportWindow", () => {
  it("month 2024-02 leap year -> 29 days", () => {
    const w = resolveReportWindow({ period: "month", year: 2024, month: 2, granularity: "auto", currency: "USD", disposition: "attachment" } as never);
    expect(w.from.toISOString()).toBe("2024-02-01T00:00:00.000Z");
    expect(w.to.toISOString()).toBe("2024-03-01T00:00:00.000Z");
    expect(w.label).toBe("2024-02");
    expect(w.bucket).toBe("day");
  });

  it("month 2026-02 non-leap -> 28 days", () => {
    const w = resolveReportWindow({ period: "month", year: 2026, month: 2, granularity: "auto", currency: "USD", disposition: "attachment" } as never);
    expect(w.to.toISOString()).toBe("2026-03-01T00:00:00.000Z");
  });

  it("quarter Q4 rolls to next year", () => {
    const w = resolveReportWindow({ period: "quarter", year: 2026, quarter: 4, granularity: "auto", currency: "USD", disposition: "attachment" } as never);
    expect(w.from.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(w.to.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(w.label).toBe("2026 Q4");
  });

  it("quarter Q2 -> Apr-Jun", () => {
    const w = resolveReportWindow({ period: "quarter", year: 2026, quarter: 2, granularity: "auto", currency: "USD", disposition: "attachment" } as never);
    expect(w.from.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    expect(w.to.toISOString()).toBe("2026-07-01T00:00:00.000Z");
  });

  it("year -> Jan01 to next Jan01", () => {
    const w = resolveReportWindow({ period: "year", year: 2026, granularity: "auto", currency: "USD", disposition: "attachment" } as never);
    expect(w.from.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(w.to.toISOString()).toBe("2027-01-01T00:00:00.000Z");
    expect(w.label).toBe("2026");
    expect(w.bucket).toBe("month");
  });

  it("custom range label", () => {
    const from = new Date("2026-01-10T05:00:00Z");
    const to = new Date("2026-01-20T00:00:00Z");
    const w = resolveReportWindow({ period: "custom", date_from: from, date_to: to, granularity: "auto", currency: "USD", disposition: "attachment" } as never);
    expect(w.from).toBe(from);
    expect(w.to).toBe(to);
    expect(w.label).toBe("2026-01-10 to 2026-01-20");
  });

  it("auto bucket day for <=31d, month for >31d", () => {
    const w30 = resolveReportWindow({ period: "custom", date_from: new Date("2026-01-01T00:00:00Z"), date_to: new Date("2026-01-31T00:00:00Z"), granularity: "auto", currency: "USD", disposition: "attachment" } as never);
    expect(w30.bucket).toBe("day");
    const w90 = resolveReportWindow({ period: "custom", date_from: new Date("2026-01-01T00:00:00Z"), date_to: new Date("2026-04-01T00:00:00Z"), granularity: "auto", currency: "USD", disposition: "attachment" } as never);
    expect(w90.bucket).toBe("month");
  });

  it("explicit granularity overrides auto", () => {
    const w = resolveReportWindow({ period: "custom", date_from: new Date("2026-01-01T00:00:00Z"), date_to: new Date("2026-01-10T00:00:00Z"), granularity: "month", currency: "USD", disposition: "attachment" } as never);
    expect(w.bucket).toBe("month");
    const w2 = resolveReportWindow({ period: "custom", date_from: new Date("2026-01-01T00:00:00Z"), date_to: new Date("2026-12-31T00:00:00Z"), granularity: "day", currency: "USD", disposition: "attachment" } as never);
    expect(w2.bucket).toBe("day");
  });

  it("month December -> next year Jan", () => {
    const w = resolveReportWindow({ period: "month", year: 2026, month: 12, granularity: "auto", currency: "USD", disposition: "attachment" } as never);
    expect(w.to.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("quarter Q1 -> Jan-Mar", () => {
    const w = resolveReportWindow({ period: "quarter", year: 2026, quarter: 1, granularity: "auto", currency: "USD", disposition: "attachment" } as never);
    expect(w.from.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(w.to.toISOString()).toBe("2026-04-01T00:00:00.000Z");
  });
});
