export type ReportPeriod = "month" | "quarter" | "year" | "custom";
export type ReportGranularity = "auto" | "day" | "month";
export type ReportDisposition = "attachment" | "inline";
export type ReportCurrency = "USD" | "EUR" | "GBP" | "EGP" | "SAR" | "AED";

export interface ReportWindow {
  from: Date;
  to: Date;
  label: string;
  bucket: "day" | "month";
  period: ReportPeriod;
}

export interface ReportFilename {
  name: string;
  disposition: ReportDisposition;
}

export const SUPPORTED_CURRENCIES: ReportCurrency[] = ["USD", "EUR", "GBP", "EGP", "SAR", "AED"];
export const REPORT_PERIODS: ReportPeriod[] = ["month", "quarter", "year", "custom"];

export function buildFilename(
  kind: "pnl" | "expenses" | "revenue",
  window: ReportWindow,
): string {
  const suffix = window.label.replace(/\s+/g, "-").toLowerCase();
  return `${kind}-${suffix}.pdf`;
}
