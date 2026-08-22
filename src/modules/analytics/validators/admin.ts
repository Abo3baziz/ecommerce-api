import { z } from "zod";
import { publicIdParam } from "../shared/validators.js";


export const EXPENSE_CATEGORIES = [
  "RENT",
  "SALARIES",
  "MARKETING",
  "UTILITIES",
  "SHIPPING",
  "SOFTWARE",
  "OTHER",
] as const;

const categoryField = z.enum(EXPENSE_CATEGORIES);
const descriptionField = z.string().trim().min(1).max(255);
const amountField = z.coerce.number().min(0.01).max(99_999_999);

export const overviewQuerySchema = z.object({
  query: z.object({
    date_from: z.coerce.date().optional(),
    date_to: z.coerce.date().optional(),
  }),
});

export type OverviewQuery = z.infer<typeof overviewQuerySchema.shape.query>;

export const listAnalyticsExpensesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    category: categoryField.optional(),
    date_from: z.coerce.date().optional(),
    date_to: z.coerce.date().optional(),
  }),
});

export type ListAnalyticsExpensesQuery = z.infer<
  typeof listAnalyticsExpensesSchema.shape.query
>;

export const createAnalyticsExpenseSchema = z.object({
  body: z.object({
    description: descriptionField,
    category: categoryField,
    amount: amountField,
    spent_at: z.coerce.date(),
  }),
});

export type CreateAnalyticsExpenseBody = z.infer<
  typeof createAnalyticsExpenseSchema.shape.body
>;

export const updateAnalyticsExpenseSchema = z.object({
  params: z.object({
    expense_public_id: publicIdParam,
  }),
  body: z
    .object({
      description: descriptionField.optional(),
      category: categoryField.optional(),
      amount: amountField.optional(),
      spent_at: z.coerce.date().optional(),
    })
    .refine((body) => Object.keys(body).length > 0, {
      message: "At least one field must be provided",
    }),
});

export type UpdateAnalyticsExpenseBody = z.infer<
  typeof updateAnalyticsExpenseSchema.shape.body
>;

export const analyticsExpenseParamsSchema = z.object({
  params: z.object({
    expense_public_id: publicIdParam,
  }),
});

export type AnalyticsExpenseParams = z.infer<
  typeof analyticsExpenseParamsSchema.shape.params
>;
