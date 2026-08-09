import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { authentication } from "../../../middleware/authentication.js";
import { authorization } from "../../../middleware/authorization.js";
import { user_role } from "../../../generated/prisma/enums.js";
import {
  categoryParamsSchema,
  categoryProductParamsSchema,
  createCategorySchema,
  listAdminCategoriesSchema,
  updateCategorySchema,
} from "../validators/category.js";
import {
  assignProductController,
  createCategoryController,
  deleteCategoryController,
  getAdminCategoryController,
  listAdminCategoriesController,
  unassignProductController,
  updateCategoryController,
} from "../controller/category.controller.js";

const adminCategoriesRouter = Router();

adminCategoriesRouter.use(authentication);
adminCategoriesRouter.use(authorization(user_role.ADMIN, user_role.SUPER_ADMIN));

adminCategoriesRouter.get(
  "/",
  validate(listAdminCategoriesSchema),
  listAdminCategoriesController,
);
adminCategoriesRouter.post(
  "/",
  validate(createCategorySchema),
  createCategoryController,
);
adminCategoriesRouter.get(
  "/:category_public_id",
  validate(categoryParamsSchema),
  getAdminCategoryController,
);
adminCategoriesRouter.patch(
  "/:category_public_id",
  validate(updateCategorySchema),
  updateCategoryController,
);
adminCategoriesRouter.delete(
  "/:category_public_id",
  validate(categoryParamsSchema),
  deleteCategoryController,
);
adminCategoriesRouter.put(
  "/:category_public_id/products/:product_public_id",
  validate(categoryProductParamsSchema),
  assignProductController,
);
adminCategoriesRouter.delete(
  "/:category_public_id/products/:product_public_id",
  validate(categoryProductParamsSchema),
  unassignProductController,
);

export { adminCategoriesRouter };
