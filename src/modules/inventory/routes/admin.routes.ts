import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { authentication } from "../../../middleware/authentication.js";
import { authorization } from "../../../middleware/authorization.js";
import { user_role } from "../../../generated/prisma/enums.js";
import {
  createInventorySchema,
  inventoryParamsSchema,
  listInventorySchema,
  reserveInventorySchema,
  updateInventorySchema,
} from "../validators/inventory.js";
import {
  createInventoryController,
  getInventoryController,
  listInventoryController,
  reserveInventoryController,
  updateInventoryController,
} from "../controller/inventory.controller.js";

const adminInventoryRouter = Router();

adminInventoryRouter.use(authentication);
adminInventoryRouter.use(authorization(user_role.ADMIN, user_role.SUPER_ADMIN));

adminInventoryRouter.get(
  "/",
  validate(listInventorySchema),
  listInventoryController,
);
adminInventoryRouter.post(
  "/",
  validate(createInventorySchema),
  createInventoryController,
);
adminInventoryRouter.get(
  "/:variant_public_id",
  validate(inventoryParamsSchema),
  getInventoryController,
);
adminInventoryRouter.patch(
  "/:variant_public_id",
  validate(updateInventorySchema),
  updateInventoryController,
);
adminInventoryRouter.patch(
  "/:variant_public_id/reserve",
  validate(reserveInventorySchema),
  reserveInventoryController,
);

export { adminInventoryRouter };
