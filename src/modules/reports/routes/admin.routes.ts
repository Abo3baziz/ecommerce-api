import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { authentication } from "../../../middleware/authentication.js";
import { authorization } from "../../../middleware/authorization.js";
import { user_role } from "../../../generated/prisma/enums.js";
import { reportQuerySchema } from "../validators/admin.js";
import {
  getExpensesReportController,
  getPnlReportController,
  getRevenueReportController,
} from "../controller/admin.controller.js";

export const adminReportsRouter = Router();

// All reports are SUPER_ADMIN-only (financial data)
adminReportsRouter.use(authentication);
adminReportsRouter.use(authorization(user_role.SUPER_ADMIN));

// P&L report — PDF by default, JSON when ?format=json
adminReportsRouter.get("/pnl", validate(reportQuerySchema), getPnlReportController);
adminReportsRouter.get("/pnl.pdf", validate(reportQuerySchema), getPnlReportController);

// Expenses report
adminReportsRouter.get("/expenses", validate(reportQuerySchema), getExpensesReportController);
adminReportsRouter.get("/expenses.pdf", validate(reportQuerySchema), getExpensesReportController);

// Revenue report
adminReportsRouter.get("/revenue", validate(reportQuerySchema), getRevenueReportController);
adminReportsRouter.get("/revenue.pdf", validate(reportQuerySchema), getRevenueReportController);
