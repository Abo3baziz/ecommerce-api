import { z } from "zod";
import { EXPENSE_CATEGORIES } from "../../analytics/validators/admin.js";

export const REPORT_PERIODS = ["month", "quarter", "year", "custom"] as const;
export const REPORT_CURRENCIES = ["USD", "EUR", "GBP", "EGP", "SAR", "AED"] as const;
export const REPORT_GRANULARITIES = ["auto", "day", "month"] as const;
export const REPORT_DISPOSITIONS = ["attachment", "inline"] as const;

const MAX_CUSTOM_RANGE_DAYS = 366;

function daysBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000);
}

const baseReportQuery = z.object({
  period: z.enum(REPORT_PERIODS).default("custom"),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  quarter: z.coerce.number().int().min(1).max(4).optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
  granularity: z.enum(REPORT_GRANULARITIES).default("auto"),
  currency: z.enum(REPORT_CURRENCIES).default("USD"),
  disposition: z.enum(REPORT_DISPOSITIONS).default("attachment"),
  format: z.enum(["pdf", "json"]).optional(),
  category: z.enum(EXPENSE_CATEGORIES).optional(),
});

function refinePeriodFields(data: z.infer<typeof baseReportQuery>, ctx: z.RefinementCtx) {
  const { period, year, month, quarter, date_from, date_to } = data;

  if (period === "month") {
    if (year === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "year is required when period is month", path: ["year"] });
    if (month === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "month is required when period is month", path: ["month"] });
    if (quarter !== undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "quarter must not be provided when period is month", path: ["quarter"] });
    if (date_from !== undefined || date_to !== undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "date_from/date_to must not be provided when period is month", path: ["date_from"] });
  } else if (period === "quarter") {
    if (year === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "year is required when period is quarter", path: ["year"] });
    if (quarter === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "quarter is required when period is quarter", path: ["quarter"] });
    if (month !== undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "month must not be provided when period is quarter", path: ["month"] });
    if (date_from !== undefined || date_to !== undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "date_from/date_to must not be provided when period is quarter", path: ["date_from"] });
  } else if (period === "year") {
    if (year === undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "year is required when period is year", path: ["year"] });
    if (month !== undefined || quarter !== undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "month/quarter must not be provided when period is year", path: ["month"] });
    if (date_from !== undefined || date_to !== undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "date_from/date_to must not be provided when period is year", path: ["date_from"] });
  } else if (period === "custom") {
    if (year !== undefined || month !== undefined || quarter !== undefined) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "year/month/quarter must not be provided when period is custom", path: ["year"] });
    if (!date_from || !date_to) {
      if (!date_from) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "date_from is required when period is custom", path: ["date_from"] });
      if (!date_to) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "date_to is required when period is custom", path: ["date_to"] });
    } else {
      if (date_from.getTime() >= date_to.getTime()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "date_from must be before date_to", path: ["date_from"] });
      }
      const d = daysBetween(date_from, date_to);
      if (d > MAX_CUSTOM_RANGE_DAYS) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `custom range must not exceed ${MAX_CUSTOM_RANGE_DAYS} days`, path: ["date_to"] });
      }
    }
  }
}

export const reportQuerySchema = z.object({
  query: baseReportQuery.superRefine(refinePeriodFields),
});

export type ReportQuery = z.infer<typeof reportQuerySchema.shape.query>;

export const pnlReportQuerySchema = reportQuerySchema;
export type PnlReportQuery = ReportQuery;

export const expensesReportQuerySchema = reportQuerySchema;
export type ExpensesReportQuery = ReportQuery;

export const revenueReportQuerySchema = reportQuerySchema;
export type RevenueReportQuery = ReportQuery;
