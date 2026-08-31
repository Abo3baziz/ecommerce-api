import { formatMoney, formatPct, formatDateUTC, formatDateTimeUTC } from "../../../shared/pdf/format.js";
import {
  createDocument,
  pdfBuffer,
  addHeader,
  addSectionTitle,
  addKpiGrid,
  drawKeyValueTable,
  drawTable,
  addFootnote,
  addPageNumbers,
} from "../../../shared/pdf/builder.js";
import { drawSeriesLineChart, drawBarChart, drawPieChart, PIE_COLORS } from "../../../shared/pdf/charts.js";
import type { PnlData, ExpensesData, RevenueData } from "./report.service.js";

function rangeLabel(window: { from: Date; to: Date }): string {
  return `${formatDateUTC(window.from)} to ${formatDateUTC(window.to)} (exclusive)`;
}

export async function renderPnlPdf(data: PnlData, currency: string, actor?: string): Promise<Buffer> {
  const doc = createDocument();
  // buffer pages for footer numbering
  (doc as unknown as { bufferedPageRange: () => { count: number } }).bufferedPageRange;
  // enable buffering
  const docAny = doc as unknown as { bufferPages?: boolean };
  // pdfkit buffers by default when not streaming

  addHeader(doc, "P&L Statement", data.window.label, {
    range: rangeLabel(data.window),
    generatedAt: formatDateTimeUTC(new Date()),
    currency,
    actor,
  });

  // KPI grid
  addKpiGrid(doc, [
    { label: "Product Revenue", value: formatMoney(data.revenue.product_revenue, currency) },
    { label: "Collected Total", value: formatMoney(data.revenue.collected_total, currency) },
    { label: "Net Profit", value: formatMoney(data.profit.net_profit, currency), hint: `Margin ${formatPct(data.profit.net_margin_pct)}` },
    { label: "Orders", value: String(data.orders.count), hint: `AOV ${formatMoney(data.orders.avg_order_value, currency)}` },
  ]);

  // Revenue
  addSectionTitle(doc, "Revenue");
  drawKeyValueTable(doc, [
    ["Product revenue (subtotal − discount)", formatMoney(data.revenue.product_revenue, currency)],
    ["Collected total (incl. shipping/tax)", formatMoney(data.revenue.collected_total, currency)],
    ["Shipping collected", formatMoney(data.revenue.shipping_collected, currency)],
    ["Tax collected", formatMoney(data.revenue.tax_collected, currency)],
    ["Discounts given", formatMoney(data.revenue.discounts_given, currency)],
    ["Refunded total (separate)", formatMoney(data.revenue.refunded_total, currency)],
  ]);

  // Costs
  addSectionTitle(doc, "Costs");
  drawKeyValueTable(doc, [
    ["COGS (quantity × cost_price)", formatMoney(data.costs.cogs, currency)],
    ["Operating expenses", formatMoney(data.costs.operating_expenses, currency)],
    ["Total costs (COGS + opex)", formatMoney(data.costs.total_costs, currency)],
  ]);
  if (data.costs.byCategory.length) {
    const totalDec = Number(data.costs.operating_expenses) || 1;
    drawTable(
      doc,
      ["Expense category", "Amount", "Share"],
      data.costs.byCategory.map((r) => [
        r.category,
        formatMoney(r.total, currency),
        totalDec ? `${((Number(r.total) / totalDec) * 100).toFixed(1)}%` : "0%",
      ]),
      [180, 170, 173],
    );
    drawBarChart(
      doc,
      data.costs.byCategory.slice(0, 7).map((r, i) => ({
        label: r.category.slice(0, 8),
        value: Number(r.total),
        color: PIE_COLORS[i % PIE_COLORS.length],
      })),
      { title: "Operating expenses by category" },
    );
  }

  // Profit
  addSectionTitle(doc, "Profit");
  drawKeyValueTable(doc, [
    ["Gross profit (revenue − COGS)", formatMoney(data.profit.gross_profit, currency)],
    ["Net profit (gross − opex)", formatMoney(data.profit.net_profit, currency)],
    ["Net margin", formatPct(data.profit.net_margin_pct)],
  ]);

  // Orders & customers
  addSectionTitle(doc, "Orders & Customers");
  drawKeyValueTable(doc, [
    ["Order count", String(data.orders.count)],
    ["Average order value", formatMoney(data.orders.avg_order_value, currency)],
    ["Discounted orders", formatPct(data.sales_quality.discounted_orders_pct)],
    ["Coupons redeemed", String(data.sales_quality.coupons_redeemed)],
    ["Active customers", String(data.customers.total_active)],
    ["New customers (in range)", String(data.customers.new_in_range)],
    ["Repeat purchase", formatPct(data.customers.repeat_purchase_pct)],
  ]);

  // Series chart + table
  addSectionTitle(doc, `Series (${data.window.bucket})`);
  const seriesPoints = data.series.map((p) => ({
    label: p.bucket_start.slice(0, 10),
    revenue: Number(p.product_revenue),
    costs: Number(p.costs),
  }));
  if (seriesPoints.length > 1) {
    drawSeriesLineChart(doc, seriesPoints, { title: `Product revenue vs costs (${data.window.bucket})` });
  } else if (seriesPoints.length === 1) {
    drawKeyValueTable(doc, [
      ["Bucket", seriesPoints[0].label],
      ["Product revenue", formatMoney(seriesPoints[0].revenue, currency)],
      ["Costs", formatMoney(seriesPoints[0].costs, currency)],
    ]);
  } else {
    addFootnote(doc, "No series data for this period.");
  }
  if (data.series.length <= 20 && data.series.length > 0) {
    const headers = ["Bucket", "Product revenue", "Collected total", "Costs"];
    const rows = data.series.map((p) => [
      p.bucket_start.slice(0, 10),
      formatMoney(p.product_revenue, currency),
      formatMoney(p.collected_total, currency),
      formatMoney(p.costs, currency),
    ]);
    drawTable(doc, headers, rows, [110, 130, 130, 153]);
  } else if (data.series.length > 20) {
    addFootnote(doc, `Series contains ${data.series.length} buckets — table omitted (see JSON preview ?format=json).`);
  }

  // Top products
  addSectionTitle(doc, "Top Products (by revenue)");
  if (data.top_products.length) {
    drawTable(
      doc,
      ["#", "Product", "Units", "Revenue", "COGS", "Margin"],
      data.top_products.map((p, i) => [
        String(i + 1),
        p.name.slice(0, 28),
        String(p.units),
        formatMoney(p.revenue, currency),
        formatMoney(p.cogs, currency),
        formatPct(p.gross_margin_pct),
      ]),
      [22, 190, 50, 85, 85, 91],
    );
  } else {
    addFootnote(doc, "No product sales in this period.");
  }

  // Category share
  addSectionTitle(doc, "Category Share");
  if (data.category_share.length) {
    drawTable(
      doc,
      ["Category", "Revenue", "Share"],
      data.category_share.map((c) => [c.name.slice(0, 24), formatMoney(c.revenue, currency), formatPct(c.share_pct)]),
      [220, 150, 153],
    );
    drawPieChart(
      doc,
      data.category_share.slice(0, 6).map((c, i) => ({
        label: c.name,
        value: Number(c.revenue),
        color: PIE_COLORS[i % PIE_COLORS.length],
      })),
      { title: "Revenue by category" },
    );
  } else {
    addFootnote(doc, "No category share data for this period.");
  }

  addFootnote(doc, "COGS uses current product_variants.cost_price (historical cost snapshots are a planned enhancement). All amounts exclude cancelled/refunded orders unless noted. Times are UTC.");
  // footer page numbers: use buffered pages
  try {
    // enable buffering if available
    addPageNumbers(doc);
  } catch { /* ignore */ }

  return pdfBuffer(doc);
}

export async function renderExpensesPdf(data: ExpensesData, currency: string, actor?: string): Promise<Buffer> {
  const doc = createDocument();
  addHeader(doc, "Expenses Report", data.window.label, {
    range: rangeLabel(data.window),
    generatedAt: formatDateTimeUTC(new Date()),
    currency,
    actor,
  });

  addKpiGrid(doc, [
    { label: "Total expenses", value: formatMoney(data.totals.total, currency) },
    { label: "Average / day", value: formatMoney(data.totals.avgPerDay, currency) },
    { label: "Entries", value: String(data.totals.count) },
    { label: "Period days", value: String(Math.max(1, Math.round((data.window.to.getTime() - data.window.from.getTime()) / (86400000)))) },
  ]);

  addSectionTitle(doc, "Summary by Category");
  if (data.byCategory.length) {
    drawTable(
      doc,
      ["Category", "Total", "Share"],
      data.byCategory.map((r) => [r.category, formatMoney(r.total, currency), formatPct(r.share_pct)]),
      [180, 170, 173],
    );
    drawBarChart(
      doc,
      data.byCategory.slice(0, 7).map((r, i) => ({
        label: r.category.slice(0, 8),
        value: Number(r.total),
        color: PIE_COLORS[i % PIE_COLORS.length],
      })),
      { title: "Expenses by category" },
    );
  } else {
    addFootnote(doc, "No expenses in this period.");
  }

  addSectionTitle(doc, `Detail (up to 500 rows, ${data.expenses.length} shown)`);
  if (data.expenses.length) {
    const headers = ["Date", "ID", "Description", "Category", "Amount", "Created by"];
    const rows = data.expenses.map((e) => [
      e.spent_at,
      e.public_id,
      e.description.slice(0, 30),
      e.category,
      formatMoney(e.amount, currency),
      e.created_by.slice(0, 18),
    ]);
    // widths total 523: 62+72+150+72+70+97
    drawTable(doc, headers, rows, [62, 72, 150, 72, 70, 97]);
  } else {
    addFootnote(doc, "No expense entries match the selected window / category.");
  }

  addFootnote(doc, "Expenses are operating_expenses with spent_at DATE. Totals use BETWEEN from::date AND to::date (UTC bounds).");
  try { addPageNumbers(doc); } catch { /* ignore */ }
  return pdfBuffer(doc);
}

export async function renderRevenuePdf(data: RevenueData, currency: string, actor?: string): Promise<Buffer> {
  const doc = createDocument();
  addHeader(doc, "Revenue Report", data.window.label, {
    range: rangeLabel(data.window),
    generatedAt: formatDateTimeUTC(new Date()),
    currency,
    actor,
  });

  addKpiGrid(doc, [
    { label: "Product revenue", value: formatMoney(data.revenue.product_revenue, currency) },
    { label: "Collected total", value: formatMoney(data.revenue.collected_total, currency) },
    { label: "Orders", value: String(data.orders.count), hint: `AOV ${formatMoney(data.orders.avg_order_value, currency)}` },
    { label: "Refunded", value: formatMoney(data.revenue.refunded_total, currency) },
  ]);

  addSectionTitle(doc, "Revenue Summary");
  drawKeyValueTable(doc, [
    ["Product revenue", formatMoney(data.revenue.product_revenue, currency)],
    ["Collected total", formatMoney(data.revenue.collected_total, currency)],
    ["Discounts given", formatMoney(data.revenue.discounts_given, currency)],
    ["Refunded total", formatMoney(data.revenue.refunded_total, currency)],
    ["Order count", String(data.orders.count)],
    ["Avg order value", formatMoney(data.orders.avg_order_value, currency)],
  ]);

  addSectionTitle(doc, `Series (${data.window.bucket})`);
  const seriesPoints = data.series.map((p) => ({
    label: p.bucket_start.slice(0, 10),
    revenue: Number(p.collected_total),
    costs: Number(p.product_revenue),
  }));
  if (seriesPoints.length > 1) {
    drawSeriesLineChart(doc, seriesPoints, { title: `Collected total vs product revenue (${data.window.bucket})` });
  } else if (seriesPoints.length === 1) {
    drawKeyValueTable(doc, [
      ["Bucket", seriesPoints[0].label],
      ["Collected", formatMoney(seriesPoints[0].revenue, currency)],
      ["Product revenue", formatMoney(seriesPoints[0].costs, currency)],
    ]);
  } else {
    addFootnote(doc, "No series data for this period.");
  }
  if (data.series.length <= 20 && data.series.length > 0) {
    drawTable(
      doc,
      ["Bucket", "Product revenue", "Collected total", "Costs (opex)"],
      data.series.map((p) => [
        p.bucket_start.slice(0, 10),
        formatMoney(p.product_revenue, currency),
        formatMoney(p.collected_total, currency),
        formatMoney(p.costs, currency),
      ]),
      [110, 130, 130, 153],
    );
  } else if (data.series.length > 20) {
    addFootnote(doc, `Series has ${data.series.length} buckets — table omitted (use ?format=json).`);
  }

  addSectionTitle(doc, "Top Products");
  if (data.top_products.length) {
    drawTable(
      doc,
      ["#", "Product", "Units", "Revenue", "COGS", "Margin"],
      data.top_products.map((p, i) => [
        String(i + 1),
        p.name.slice(0, 28),
        String(p.units),
        formatMoney(p.revenue, currency),
        formatMoney(p.cogs, currency),
        formatPct(p.gross_margin_pct),
      ]),
      [22, 190, 50, 85, 85, 91],
    );
  } else {
    addFootnote(doc, "No product sales in this period.");
  }

  addSectionTitle(doc, "Category Share");
  if (data.category_share.length) {
    drawTable(
      doc,
      ["Category", "Revenue", "Share"],
      data.category_share.map((c) => [c.name.slice(0, 24), formatMoney(c.revenue, currency), formatPct(c.share_pct)]),
      [220, 150, 153],
    );
    drawPieChart(
      doc,
      data.category_share.slice(0, 6).map((c, i) => ({
        label: c.name,
        value: Number(c.revenue),
        color: PIE_COLORS[i % PIE_COLORS.length],
      })),
      { title: "Revenue by category" },
    );
  } else {
    addFootnote(doc, "No category share data for this period.");
  }

  addFootnote(doc, "Revenue is sum of qualifying orders (status not in CANCELLED, REFUNDED). Refunded shown separately.");
  try { addPageNumbers(doc); } catch { /* ignore */ }
  return pdfBuffer(doc);
}
