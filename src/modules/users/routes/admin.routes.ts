import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { authentication } from "../../../middleware/authentication.js";
import { authorization } from "../../../middleware/authorization.js";
import { user_role } from "../../../generated/prisma/enums.js";
import {
  adminUserParamsSchema,
  changeUserRoleSchema,
  listAdminUsersSchema,
  updateAdminUserSchema,
} from "../validators/admin.js";
import {
  activateUserController,
  changeUserRoleController,
  getAdminUserController,
  listAdminUsersController,
  suspendUserController,
  updateAdminUserController,
} from "../controller/admin.controller.js";

const adminUsersRouter = Router();

adminUsersRouter.use(authentication);
adminUsersRouter.use(authorization(user_role.ADMIN, user_role.SUPER_ADMIN));

adminUsersRouter.get("/", validate(listAdminUsersSchema), listAdminUsersController);
adminUsersRouter.get(
  "/:user_public_id",
  validate(adminUserParamsSchema),
  getAdminUserController,
);
adminUsersRouter.patch(
  "/:user_public_id/role",
  authorization(user_role.SUPER_ADMIN),
  validate(changeUserRoleSchema),
  changeUserRoleController,
);
adminUsersRouter.patch(
  "/:user_public_id/suspend",
  validate(adminUserParamsSchema),
  suspendUserController,
);
adminUsersRouter.patch(
  "/:user_public_id/activate",
  validate(adminUserParamsSchema),
  activateUserController,
);
adminUsersRouter.patch(
  "/:user_public_id",
  validate(updateAdminUserSchema),
  updateAdminUserController,
);

export { adminUsersRouter };
