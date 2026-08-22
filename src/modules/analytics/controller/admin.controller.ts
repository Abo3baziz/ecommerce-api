import { Request, Response, NextFunction } from "express";
import { getAnalyticsOverview } from "../service/overview.service.js";
import {
  createExpense,
  deleteExpense,
  listExpenses,
  updateExpense,
} from "../service/expenses.service.js";
import type {
  CreateAnalyticsExpenseBody,
  ListAnalyticsExpensesQuery,
  OverviewQuery,
  UpdateAnalyticsExpenseBody,
} from "../validators/admin.js";

export async function getAnalyticsOverviewController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { date_from, date_to } = req.query as unknown as OverviewQuery;
    const data = await getAnalyticsOverview(date_from, date_to);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function listAnalyticsExpensesController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { page, limit, category, date_from, date_to } =
      req.query as unknown as ListAnalyticsExpensesQuery;
    const data = await listExpenses(page, limit, {
      category,
      from: date_from,
      to: date_to,
    });
    res.status(200).json({
      success: true,
      data: data.expenses,
      pagination: data.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function createAnalyticsExpenseController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as CreateAnalyticsExpenseBody;
    const data = await createExpense(body, { id: req.user!.id });
    res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAnalyticsExpenseController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { expense_public_id } = req.params as { expense_public_id: string };
    const data = await updateExpense(
      expense_public_id,
      req.body as UpdateAnalyticsExpenseBody,
    );
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteAnalyticsExpenseController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { expense_public_id } = req.params as { expense_public_id: string };
    await deleteExpense(expense_public_id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
