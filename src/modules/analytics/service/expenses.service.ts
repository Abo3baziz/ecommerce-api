import { Prisma } from "../../../generated/prisma/client.js";
import type { expense_category } from "../../../generated/prisma/enums.js";
import { PUBLIC_ID_PREFIXES } from "../../../shared/constants/index.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import { generatePublicId } from "../../../shared/utils/index.js";
import { formatPaginationMeta } from "../../../shared/utils/index.js";
import type {
  ListExpensesResult,
  OperatingExpenseResult,
} from "../dto/analytics.js";
import { toExpenseResult } from "../dto/analytics.js";
import {
  expensesRepository,
  type ExpenseRow,
} from "../repository/analytics.repository.js";

export interface ExpenseActor {
  id: number;
}

export async function listExpenses(
  page: number,
  limit: number,
  filters: { category?: expense_category; from?: Date; to?: Date },
): Promise<ListExpensesResult> {
  const [rows, total] = await Promise.all([
    expensesRepository.list(filters, (page - 1) * limit, limit),
    expensesRepository.count(filters),
  ]);
  return {
    expenses: rows.map(toExpenseResult),
    pagination: formatPaginationMeta(page, limit, total),
  };
}

export async function createExpense(
  input: {
    description: string;
    category: expense_category;
    amount: number;
    spent_at: Date;
  },
  actor: ExpenseActor,
): Promise<OperatingExpenseResult> {
  const created = await expensesRepository.create({
    public_id: generatePublicId(PUBLIC_ID_PREFIXES.EXPENSE),
    description: input.description,
    category: input.category,
    amount: new Prisma.Decimal(input.amount),
    spent_at: input.spent_at,
    created_by_users_id: actor.id,
  });
  return toExpenseResult(created);
}

export async function updateExpense(
  expensePublicId: string,
  input: {
    description?: string;
    category?: expense_category;
    amount?: number;
    spent_at?: Date;
  },
): Promise<OperatingExpenseResult> {
  const existing = await expensesRepository.findByPublicId(expensePublicId);
  if (!existing) {
    throw new NotFoundError("Expense not found");
  }

  const data: {
    description?: string;
    category?: expense_category;
    amount?: Prisma.Decimal;
    spent_at?: Date;
  } = {};
  if (input.description !== undefined) data.description = input.description;
  if (input.category !== undefined) data.category = input.category;
  if (input.amount !== undefined) data.amount = new Prisma.Decimal(input.amount);
  if (input.spent_at !== undefined) data.spent_at = input.spent_at;

  const updated = await expensesRepository.update(existing.id, data);
  return toExpenseResult(updated);
}

export async function deleteExpense(expensePublicId: string): Promise<void> {
  const existing = await expensesRepository.findByPublicId(expensePublicId);
  if (!existing) {
    throw new NotFoundError("Expense not found");
  }
  await expensesRepository.remove(existing.id);
}
