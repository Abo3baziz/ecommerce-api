import { Router } from "express";
import type { Request, Response, NextFunction } from "express";
import { validate } from "../../../middleware/validate.js";
import { authentication } from "../../../middleware/authentication.js";
import { authorization } from "../../../middleware/authorization.js";
import { user_role } from "../../../generated/prisma/enums.js";
import {
  getSettingsSchema,
  patchAdminPermissionsSchema,
  patchCommerceSchema,
  patchCustomerSchema,
  patchEmailSchema,
  patchFinancialSchema,
  patchGeneralSchema,
  patchPaymentSchema,
  patchSecuritySchema,
  patchShippingSchema,
  testEmailSchema,
  type SettingsKey,
} from "../validators/admin.js";
import {
  getSettingsController,
  patchSettingsController,
  testEmailController,
} from "../controller/admin.controller.js";

export const adminSettingsRouter = Router();

adminSettingsRouter.use(authentication);
adminSettingsRouter.use(authorization(user_role.SUPER_ADMIN));

adminSettingsRouter.get("/", validate(getSettingsSchema), getSettingsController);

// Static paths leave req.params empty, so the section is bound here for the
// validator's params literal and the controller's dispatch.
function withSection(section: SettingsKey) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    req.params = { ...req.params, section };
    next();
  };
}

adminSettingsRouter.patch("/general", withSection("general"), validate(patchGeneralSchema), patchSettingsController);
adminSettingsRouter.patch("/commerce", withSection("commerce"), validate(patchCommerceSchema), patchSettingsController);
adminSettingsRouter.patch("/payment", withSection("payment"), validate(patchPaymentSchema), patchSettingsController);
adminSettingsRouter.patch("/shipping", withSection("shipping"), validate(patchShippingSchema), patchSettingsController);
adminSettingsRouter.patch("/email", withSection("email"), validate(patchEmailSchema), patchSettingsController);
adminSettingsRouter.patch("/customer", withSection("customer"), validate(patchCustomerSchema), patchSettingsController);
adminSettingsRouter.patch("/security", withSection("security"), validate(patchSecuritySchema), patchSettingsController);
adminSettingsRouter.patch("/admin_permissions", withSection("admin_permissions"), validate(patchAdminPermissionsSchema), patchSettingsController);
adminSettingsRouter.patch("/financial", withSection("financial"), validate(patchFinancialSchema), patchSettingsController);

// Test email (SUPER_ADMIN)
adminSettingsRouter.post("/email/test", validate(testEmailSchema), testEmailController);
