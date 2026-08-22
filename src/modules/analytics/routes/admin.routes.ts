import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { authentication } from "../../../middleware/authentication.js";
import { authorization } from "../../../middleware/authorization.js";
import { user_role } from "../../../generated/prisma/enums.js";
import {
  analyticsExpenseParamsSchema,
  createAnalyticsExpenseSchema,
  listAnalyticsExpensesSchema,
  overviewQuerySchema,
  updateAnalyticsExpenseSchema,
} from "../validators/admin.js";
import {
  createAnalyticsExpenseController,
  deleteAnalyticsExpenseController,
  getAnalyticsOverviewController,
  listAnalyticsExpensesController,
  updateAnalyticsExpenseController,
} from "../controller/admin.controller.js";

// The whole Analytics surface is SUPER_ADMIN-only: regular admins receive 403
// from the API regardless of what the UI renders.
export const adminAnalyticsRouter = Router();

adminAnalyticsRouter.use(authentication);
adminAnalyticsRouter.use(authorization(user_role.SUPER_ADMIN));

adminAnalyticsRouter.get(
  "/overview",
  validate(overviewQuerySchema),
  getAnalyticsOverviewController,
);

adminAnalyticsRouter.get(
  "/expenses",
  validate(listAnalyticsExpensesSchema),
  listAnalyticsExpensesController,
);
adminAnalyticsRouter.post(
  "/expenses",
  validate(createAnalyticsExpenseSchema),
  createAnalyticsExpenseController,
);
adminAnalyticsRouter.patch(
  "/expenses/:expense_public_id",
  validate(updateAnalyticsExpenseSchema),
  updateAnalyticsExpenseController,
);
adminAnalyticsRouter.delete(
  "/expenses/:expense_public_id",
  validate(analyticsExpenseParamsSchema),
  deleteAnalyticsExpenseController,
);
