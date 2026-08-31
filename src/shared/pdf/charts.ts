import type { PdfDoc } from "./builder.js";
import { PALETTE, PAGE } from "./styles.js";

interface SeriesPoint {
  label: string;
  revenue: number;
  costs: number;
}

export function drawSeriesLineChart(
  doc: PdfDoc,
  series: SeriesPoint[],
  opts: { title?: string; width?: number; height?: number } = {},
): void {
  const w = opts.width ?? PAGE.usableWidth;
  const h = opts.height ?? 140;
  const pad = { top: 22, right: 12, bottom: 24, left: 48 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const x0 = doc.x;
  const y0 = doc.y;

  // Reserve space
  if (doc.y + h + 12 > doc.page.height - doc.page.margins.bottom) {
    doc.addPage();
  }
  const baseX = doc.x;
  const baseY = doc.y;

  if (!series.length) {
    doc
      .fillColor(PALETTE.muted)
      .fontSize(8)
      .text("No series data for this period.", baseX, baseY + h / 2 - 6, { width: w, align: "center" });
    doc.y = baseY + h + 8;
    doc.x = PAGE.margin;
    return;
  }

  // Title
  if (opts.title) {
    doc.fillColor(PALETTE.primary).font("Helvetica-Bold").fontSize(9).text(opts.title, baseX, baseY);
  }

  const chartX = baseX + pad.left;
  const chartY = baseY + pad.top;
  // background
  doc.save().rect(baseX, baseY, w, h).fill("#F8FAFC").strokeColor(PALETTE.border).lineWidth(0.6).rect(baseX, baseY, w, h).stroke().restore();

  // axes
  doc.save().strokeColor(PALETTE.border).lineWidth(0.8).moveTo(chartX, chartY).lineTo(chartX, chartY + plotH).lineTo(chartX + plotW, chartY + plotH).stroke().restore();

  // grid lines (3 horizontal)
  for (let i = 1; i <= 3; i++) {
    const gy = chartY + (plotH * i) / 4;
    doc.save().strokeColor("#E2E8F0").lineWidth(0.4).moveTo(chartX, gy).lineTo(chartX + plotW, gy).stroke().restore();
  }

  const maxVal = Math.max(1, ...series.map((p) => Math.max(p.revenue, p.costs)));
  const stepX = series.length > 1 ? plotW / (series.length - 1) : plotW;

  // draw revenue line (accent)
  drawPolyline(doc, series, (p) => p.revenue, maxVal, chartX, chartY, plotH, stepX, PALETTE.accent, 1.8);
  // draw costs line (muted)
  drawPolyline(doc, series, (p) => p.costs, maxVal, chartX, chartY, plotH, stepX, PALETTE.muted, 1.4, [3, 3]);

  // dots for revenue
  for (let i = 0; i < series.length; i++) {
    const px = chartX + i * stepX;
    const py = chartY + plotH - (series[i].revenue / maxVal) * plotH;
    doc.save().circle(px, py, 2).fill(PALETTE.accent).restore();
  }

  // x labels (first, middle, last to avoid crowding)
  const labelIdxs = series.length <= 6 ? series.map((_, i) => i) : [0, Math.floor(series.length / 2), series.length - 1];
  for (const idx of labelIdxs) {
    const px = chartX + idx * stepX;
    doc.fillColor(PALETTE.secondary).font("Helvetica").fontSize(6).text(series[idx].label, px - 28, chartY + plotH + 4, { width: 56, align: "center" });
  }

  // y labels
  doc.fillColor(PALETTE.secondary).fontSize(6).text(String(Math.round(maxVal)), chartX - 44, chartY - 4, { width: 40, align: "right" });
  doc.text("0", chartX - 44, chartY + plotH - 4, { width: 40, align: "right" });

  // legend
  const lx = baseX + w - 140;
  const ly = baseY + 4;
  doc.save().rect(lx, ly, 10, 3).fill(PALETTE.accent).restore();
  doc.fillColor(PALETTE.secondary).fontSize(6).text("Product revenue", lx + 14, ly - 2);
  doc.save().rect(lx + 70, ly, 10, 3).fill(PALETTE.muted).restore();
  doc.text("Costs", lx + 84, ly - 2);

  doc.y = baseY + h + 8;
  doc.x = PAGE.margin;
}

function drawPolyline(
  doc: PdfDoc,
  series: SeriesPoint[],
  accessor: (p: SeriesPoint) => number,
  maxVal: number,
  chartX: number,
  chartY: number,
  plotH: number,
  stepX: number,
  color: string,
  width: number,
  dash?: number[],
): void {
  doc.save().strokeColor(color).lineWidth(width);
  if (dash) (doc as unknown as { dash: (len: number, opts: unknown) => void }).dash?.(dash[0], { space: dash[1] });
  for (let i = 0; i < series.length; i++) {
    const px = chartX + i * stepX;
    const py = chartY + plotH - (accessor(series[i]) / maxVal) * plotH;
    if (i === 0) doc.moveTo(px, py);
    else doc.lineTo(px, py);
  }
  doc.stroke().restore();
  // undash
  try {
    (doc as unknown as { undash: () => void }).undash?.();
  } catch { /* ignore */ }
}

export function drawBarChart(
  doc: PdfDoc,
  bars: { label: string; value: number; color?: string }[],
  opts: { title?: string; width?: number; height?: number } = {},
): void {
  const w = opts.width ?? PAGE.usableWidth;
  const h = opts.height ?? 140;
  const pad = { top: 22, right: 12, bottom: 26, left: 48 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  if (doc.y + h + 12 > doc.page.height - doc.page.margins.bottom) doc.addPage();
  const baseX = doc.x;
  const baseY = doc.y;

  if (!bars.length) {
    doc.fillColor(PALETTE.muted).fontSize(8).text("No data for this period.", baseX, baseY + h / 2 - 6, { width: w, align: "center" });
    doc.y = baseY + h + 8;
    doc.x = PAGE.margin;
    return;
  }

  if (opts.title) doc.fillColor(PALETTE.primary).font("Helvetica-Bold").fontSize(9).text(opts.title, baseX, baseY);

  const chartX = baseX + pad.left;
  const chartY = baseY + pad.top;
  doc.save().rect(baseX, baseY, w, h).fill("#F8FAFC").strokeColor(PALETTE.border).lineWidth(0.6).rect(baseX, baseY, w, h).stroke().restore();
  doc.save().strokeColor(PALETTE.border).lineWidth(0.8).moveTo(chartX, chartY).lineTo(chartX, chartY + plotH).lineTo(chartX + plotW, chartY + plotH).stroke().restore();

  const maxVal = Math.max(1, ...bars.map((b) => b.value));
  const gap = 8;
  const barW = Math.max(8, (plotW - gap * (bars.length + 1)) / bars.length);

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const bh = (bar.value / maxVal) * plotH;
    const x = chartX + gap + i * (barW + gap);
    const y = chartY + plotH - bh;
    doc.save().rect(x, y, barW, bh).fill(bar.color ?? PALETTE.accent).restore();
    // value label
    if (bh > 12) {
      doc.fillColor("#FFFFFF").fontSize(5).text(String(Math.round(bar.value)), x, y + 4, { width: barW, align: "center" });
    }
    // x label
    doc.fillColor(PALETTE.secondary).fontSize(6).text(bar.label.slice(0, 10), x - 2, chartY + plotH + 4, { width: barW + 4, align: "center" });
  }
  doc.fillColor(PALETTE.secondary).fontSize(6).text(String(Math.round(maxVal)), chartX - 44, chartY - 4, { width: 40, align: "right" });
  doc.text("0", chartX - 44, chartY + plotH - 4, { width: 40, align: "right" });

  doc.y = baseY + h + 8;
  doc.x = PAGE.margin;
}

export function drawPieChart(
  doc: PdfDoc,
  slices: { label: string; value: number; color: string }[],
  opts: { title?: string; width?: number; height?: number } = {},
): void {
  const w = opts.width ?? PAGE.usableWidth;
  const h = opts.height ?? 160;

  if (doc.y + h + 12 > doc.page.height - doc.page.margins.bottom) doc.addPage();
  const baseX = doc.x;
  const baseY = doc.y;

  if (!slices.length) {
    doc.fillColor(PALETTE.muted).fontSize(8).text("No category data for this period.", baseX, baseY + h / 2 - 6, { width: w, align: "center" });
    doc.y = baseY + h + 8;
    doc.x = PAGE.margin;
    return;
  }

  if (opts.title) doc.fillColor(PALETTE.primary).font("Helvetica-Bold").fontSize(9).text(opts.title, baseX, baseY);

  const cx = baseX + 80;
  const cy = baseY + h / 2 + 8;
  const r = 52;
  const total = slices.reduce((s, v) => s + v.value, 0) || 1;
  let angle = -Math.PI / 2;

  for (const sl of slices) {
    const sweep = (sl.value / total) * Math.PI * 2;
    if (sweep <= 0) continue;
    // slice via polygon approximation
    const steps = Math.max(8, Math.ceil((sweep / (Math.PI * 2)) * 48));
    doc.save().fillColor(sl.color);
    (doc as PdfDoc).moveTo(cx, cy);
    for (let s = 0; s <= steps; s++) {
      const a = angle + (sweep * s) / steps;
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (s === 0) (doc as PdfDoc).lineTo(px, py);
      else (doc as PdfDoc).lineTo(px, py);
    }
    (doc as PdfDoc).lineTo(cx, cy).fill().restore();
    angle += sweep;
  }
  // inner white to make donut if wanted — keep pie solid

  // legend to the right
  let ly = baseY + 28;
  const lx = baseX + 160;
  for (const sl of slices.slice(0, 8)) {
    (doc as PdfDoc).save().rect(lx, ly, 10, 10).fill(sl.color).restore();
    const pct = ((sl.value / total) * 100).toFixed(1);
    doc.fillColor(PALETTE.primary).fontSize(7).text(`${sl.label.slice(0, 18)}  ${pct}%`, lx + 14, ly + 1, { width: w - (lx - baseX) - 14 });
    ly += 14;
  }

  doc.y = baseY + h + 8;
  doc.x = PAGE.margin;
}

export const PIE_COLORS = ["#2563EB", "#059669", "#D97706", "#DC2626", "#7C3AED", "#0891B2", "#BE185D", "#4338CA"] as const;
