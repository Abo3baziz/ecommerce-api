import { describe, it, expect } from "vitest";
import { createDocument, pdfBuffer, drawTable, addKpiGrid } from "../../../../src/shared/pdf/builder.js";

describe("pdf builder", () => {
  it("drawTable paginates without throwing", async () => {
    const doc = createDocument();
    const headers = ["A", "B", "C"];
    const rows = Array.from({ length: 80 }, (_, i) => [`row ${i}`, `val ${i}`, `x ${i}`]);
    drawTable(doc, headers, rows);
    const buf = await pdfBuffer(doc);
    expect(buf.slice(0, 5).toString()).toBe("%PDF-");
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("addKpiGrid does not throw on empty", async () => {
    const doc = createDocument();
    addKpiGrid(doc, []);
    const buf = await pdfBuffer(doc);
    expect(buf.slice(0, 5).toString()).toBe("%PDF-");
  });

  it("addKpiGrid with 4 cards", async () => {
    const doc = createDocument();
    addKpiGrid(doc, [
      { label: "Revenue", value: "$1,000.00" },
      { label: "Costs", value: "$200.00" },
      { label: "Profit", value: "$800.00" },
      { label: "Orders", value: "42" },
    ]);
    const buf = await pdfBuffer(doc);
    expect(buf.length).toBeGreaterThan(500);
  });
});
