import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { authentication } from "../../../middleware/authentication.js";
import { authorization } from "../../../middleware/authorization.js";
import { user_role } from "../../../generated/prisma/enums.js";
import {
  adminAccountParamsSchema,
  listAdminAccountsSchema,
} from "../validators/admin.js";
import {
  getAdminAccountController,
  listAdminAccountsController,
  suspendAdminAccountController,
  activateAdminAccountController,
} from "../controller/admin.controller.js";

export const adminAccountsRouter = Router();

adminAccountsRouter.use(authentication);
adminAccountsRouter.use(authorization(user_role.SUPER_ADMIN));

adminAccountsRouter.get(
  "/",
  validate(listAdminAccountsSchema),
  listAdminAccountsController,
);
adminAccountsRouter.get(
  "/:admin_public_id",
  validate(adminAccountParamsSchema),
  getAdminAccountController,
);
adminAccountsRouter.patch(
  "/:admin_public_id/suspend",
  validate(adminAccountParamsSchema),
  suspendAdminAccountController,
);
adminAccountsRouter.patch(
  "/:admin_public_id/activate",
  validate(adminAccountParamsSchema),
  activateAdminAccountController,
);
