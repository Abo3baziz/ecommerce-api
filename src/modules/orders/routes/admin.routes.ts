import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { authentication } from "../../../middleware/authentication.js";
import { authorization } from "../../../middleware/authorization.js";
import { user_role } from "../../../generated/prisma/enums.js";
import {
  adminOrderParamsSchema,
  listAdminOrdersSchema,
  updateOrderStatusSchema,
} from "../validators/admin.js";
import {
  getAdminOrderController,
  listAdminOrdersController,
  updateOrderStatusController,
} from "../controller/admin.controller.js";

const adminOrdersRouter = Router();

adminOrdersRouter.use(authentication);
adminOrdersRouter.use(authorization(user_role.ADMIN, user_role.SUPER_ADMIN));

adminOrdersRouter.get(
  "/",
  validate(listAdminOrdersSchema),
  listAdminOrdersController,
);
adminOrdersRouter.get(
  "/:order_public_id",
  validate(adminOrderParamsSchema),
  getAdminOrderController,
);
adminOrdersRouter.patch(
  "/:order_public_id",
  validate(updateOrderStatusSchema),
  updateOrderStatusController,
);

export { adminOrdersRouter };
