import PDFDocument from "pdfkit";
import { FONT_SIZE, PAGE, PALETTE, SPACING } from "./styles.js";

export type PdfDoc = InstanceType<typeof PDFDocument>;

export function createDocument(): PdfDoc {
  const doc = new PDFDocument({
    size: "A4",
    margins: {
      top: PAGE.margin,
      bottom: PAGE.margin,
      left: PAGE.margin,
      right: PAGE.margin,
    },
    info: {
      Title: "Financial Report",
      Author: "Ecommerce Platform",
    },
  });
  doc.font("Helvetica");
  return doc;
}

export function pdfBuffer(doc: PdfDoc): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}

export function ensureSpace(doc: PdfDoc, needed: number): void {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + needed > bottom) {
    doc.addPage();
  }
}

export function addHeader(
  doc: PdfDoc,
  title: string,
  subtitle: string,
  meta: { range: string; generatedAt: string; currency: string; actor?: string },
): void {
  // Brand bar
  doc
    .save()
    .rect(0, 0, doc.page.width, 42)
    .fill(PALETTE.headerBg)
    .restore();
  doc
    .fillColor(PALETTE.white)
    .font("Helvetica-Bold")
    .fontSize(FONT_SIZE.h2)
    .text("ECOMMERCE", PAGE.margin, 14, { continued: false });
  doc
    .font("Helvetica")
    .fontSize(FONT_SIZE.sm)
    .fillColor("#CBD5E1")
    .text("Financial Reports  •  SUPER_ADMIN", PAGE.margin + 110, 16);

  // Title block
  doc.moveDown(2.5);
  doc.fillColor(PALETTE.primary).font("Helvetica-Bold").fontSize(FONT_SIZE.h1).text(title);
  if (subtitle) {
    doc.font("Helvetica").fontSize(FONT_SIZE.label).fillColor(PALETTE.secondary).text(subtitle);
  }
  doc.moveDown(0.6);
  // Meta row
  doc
    .fontSize(FONT_SIZE.body)
    .fillColor(PALETTE.secondary)
    .text(`Range: ${meta.range}   •   Generated: ${meta.generatedAt}   •   Currency: ${meta.currency}${meta.actor ? `   •   By: ${meta.actor}` : ""}`);
  doc.moveDown(0.4);
  drawDivider(doc);
  doc.moveDown(0.6);
}

export function addSectionTitle(doc: PdfDoc, title: string): void {
  ensureSpace(doc, 30);
  doc
    .fillColor(PALETTE.primary)
    .font("Helvetica-Bold")
    .fontSize(FONT_SIZE.h3)
    .text(title);
  // underline
  const y = doc.y + 2;
  doc.save().strokeColor(PALETTE.accent).lineWidth(1.6).moveTo(doc.x, y).lineTo(doc.x + 42, y).stroke().restore();
  doc.moveDown(0.7);
}

export function addKpiGrid(
  doc: PdfDoc,
  cards: { label: string; value: string; hint?: string }[],
): void {
  const cols = 2;
  const gap = 10;
  const cardW = (PAGE.usableWidth - gap * (cols - 1)) / cols;
  const cardH = 56;
  const startY = doc.y;
  ensureSpace(doc, cardH * Math.ceil(cards.length / cols) + 8);

  let col = 0;
  let row = 0;
  for (const card of cards) {
    const x = PAGE.margin + col * (cardW + gap);
    const y = startY + row * (cardH + gap);
    // card bg
    doc
      .save()
      .roundedRect(x, y, cardW, cardH, 6)
      .fill("#F8FAFC")
      .strokeColor(PALETTE.border)
      .lineWidth(0.7)
      .roundedRect(x, y, cardW, cardH, 6)
      .stroke()
      .restore();
    doc
      .fillColor(PALETTE.secondary)
      .font("Helvetica")
      .fontSize(FONT_SIZE.sm)
      .text(card.label.toUpperCase(), x + 10, y + 10, { width: cardW - 20 });
    doc
      .fillColor(PALETTE.primary)
      .font("Helvetica-Bold")
      .fontSize(FONT_SIZE.h2)
      .text(card.value, x + 10, y + 24, { width: cardW - 20 });
    if (card.hint) {
      doc.fillColor(PALETTE.muted).font("Helvetica").fontSize(FONT_SIZE.xs).text(card.hint, x + 10, y + 42, { width: cardW - 20 });
    }

    col++;
    if (col >= cols) {
      col = 0;
      row++;
    }
  }
  const rows = Math.ceil(cards.length / cols);
  doc.y = startY + rows * (cardH + gap) + 2;
  doc.x = PAGE.margin;
}

export function drawKeyValueTable(
  doc: PdfDoc,
  rows: [string, string][],
): void {
  const col1W = 200;
  const col2W = PAGE.usableWidth - col1W;
  const rowH = 18;
  ensureSpace(doc, rowH * (rows.length + 1));
  // header
  drawTableRow(doc, ["Metric", "Value"], [col1W, col2W], true);
  for (let i = 0; i < rows.length; i++) {
    drawTableRow(doc, [rows[i][0], rows[i][1]], [col1W, col2W], false, i % 2 === 1);
  }
  doc.moveDown(0.5);
}

export function drawTable(
  doc: PdfDoc,
  headers: string[],
  rows: string[][],
  colWidths?: number[],
): void {
  const widths =
    colWidths ??
    headers.map(() => PAGE.usableWidth / headers.length);
  const headerH = 20;
  const rowH = 16;

  // header
  ensureSpace(doc, headerH + rowH);
  drawTableRow(doc, headers, widths, true);

  for (let i = 0; i < rows.length; i++) {
    // truncate cell text that would overflow col width approx chars
    const cells = rows[i].map((cell, idx) => truncateCell(cell, widths[idx]));
    ensureSpace(doc, rowH + 4);
    drawTableRow(doc, cells, widths, false, i % 2 === 1);
  }
  doc.moveDown(0.6);
}

function drawTableRow(
  doc: PdfDoc,
  cells: string[],
  widths: number[],
  isHeader: boolean,
  alt = false,
): void {
  const x0 = doc.x;
  const y0 = doc.y;
  const h = isHeader ? 20 : 16;
  const bg = isHeader ? PALETTE.headerBg : alt ? PALETTE.rowAlt : PALETTE.white;

  // background
  doc.save().rect(x0, y0, PAGE.usableWidth, h).fill(bg).restore();
  if (!isHeader) {
    doc.save().strokeColor(PALETTE.border).lineWidth(0.4).rect(x0, y0, PAGE.usableWidth, h).stroke().restore();
  }

  let x = x0;
  for (let i = 0; i < cells.length; i++) {
    const w = widths[i];
    doc
      .fillColor(isHeader ? PALETTE.white : PALETTE.primary)
      .font(isHeader ? "Helvetica-Bold" : "Helvetica")
      .fontSize(isHeader ? FONT_SIZE.sm : FONT_SIZE.xs)
      .text(cells[i], x + 5, y0 + (isHeader ? 6 : 5), {
        width: w - 10,
        height: h - 6,
        ellipsis: true,
      });
    if (i < cells.length - 1) {
      // vertical divider
      doc
        .save()
        .strokeColor(isHeader ? "#334155" : PALETTE.border)
        .lineWidth(0.4)
        .moveTo(x + w, y0)
        .lineTo(x + w, y0 + h)
        .stroke()
        .restore();
    }
    x += w;
  }
  doc.y = y0 + h;
  doc.x = x0;
}

function truncateCell(value: string, colWidth: number): string {
  // approx 5.5pt per char at 7pt;  colWidth/5.5 gives max chars
  const maxChars = Math.max(8, Math.floor(colWidth / 5.2));
  if (value.length <= maxChars) return value;
  return value.slice(0, maxChars - 3) + "...";
}

export function drawDivider(doc: PdfDoc): void {
  const y = doc.y;
  doc.save().strokeColor(PALETTE.border).lineWidth(0.6).moveTo(PAGE.margin, y).lineTo(PAGE.margin + PAGE.usableWidth, y).stroke().restore();
}

export function addFootnote(doc: PdfDoc, text: string): void {
  ensureSpace(doc, 18);
  doc.fillColor(PALETTE.muted).font("Helvetica").fontSize(FONT_SIZE.xs).text(text, PAGE.margin, doc.y, { width: PAGE.usableWidth });
  doc.font("Helvetica");
  doc.moveDown(0.4);
}

export function addPageNumbers(doc: PdfDoc): void {
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    const text = `Page ${i + 1} / ${pages.count}`;
    doc
      .fontSize(FONT_SIZE.xs)
      .fillColor(PALETTE.muted)
      .text(text, PAGE.margin, doc.page.height - PAGE.margin + 12, {
        width: PAGE.usableWidth,
        align: "center",
      });
  }
}
