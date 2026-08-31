import { Request, Response, NextFunction } from "express";
import { getPnlData, getExpensesData, getRevenueData } from "../service/report.service.js";
import { renderPnlPdf, renderExpensesPdf, renderRevenuePdf } from "../service/pdf.service.js";
import { buildFilename } from "../dto/reports.js";
import type { ReportQuery } from "../validators/admin.js";

function getCurrency(query: ReportQuery): string {
  return (query.currency as string) ?? "USD";
}

function getDisposition(query: ReportQuery): "attachment" | "inline" {
  return (query.disposition as "attachment" | "inline") ?? "attachment";
}

function sendPdf(res: Response, buffer: Buffer, filename: string, disposition: string, currency: string): void {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
  res.setHeader("Content-Length", String(buffer.length));
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Report-Currency", currency);
  res.status(200).end(buffer);
}

export async function getPnlReportController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = req.query as unknown as ReportQuery;
    const currency = getCurrency(query);
    const disposition = getDisposition(query);

    if (query.format === "json") {
      const data = await getPnlData(query);
      res.status(200).json({ success: true, data });
      return;
    }

    const data = await getPnlData(query);
    const actor = (req.user as { public_id?: string } | undefined)?.public_id ?? undefined;
    const filename = buildFilename("pnl", data.window);
    const buffer = await renderPnlPdf(data, currency, actor);
    sendPdf(res, buffer, filename, disposition, currency);
  } catch (error) {
    next(error);
  }
}

export async function getExpensesReportController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = req.query as unknown as ReportQuery;
    const currency = getCurrency(query);
    const disposition = getDisposition(query);

    if (query.format === "json") {
      const data = await getExpensesData(query);
      res.status(200).json({ success: true, data });
      return;
    }

    const data = await getExpensesData(query);
    const actor = (req.user as { public_id?: string } | undefined)?.public_id ?? undefined;
    const filename = buildFilename("expenses", data.window);
    const buffer = await renderExpensesPdf(data, currency, actor);
    sendPdf(res, buffer, filename, disposition, currency);
  } catch (error) {
    next(error);
  }
}

export async function getRevenueReportController(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const query = req.query as unknown as ReportQuery;
    const currency = getCurrency(query);
    const disposition = getDisposition(query);

    if (query.format === "json") {
      const data = await getRevenueData(query);
      res.status(200).json({ success: true, data });
      return;
    }

    const data = await getRevenueData(query);
    const actor = (req.user as { public_id?: string } | undefined)?.public_id ?? undefined;
    const filename = buildFilename("revenue", data.window);
    const buffer = await renderRevenuePdf(data, currency, actor);
    sendPdf(res, buffer, filename, disposition, currency);
  } catch (error) {
    next(error);
  }
}
