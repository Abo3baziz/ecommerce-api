import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import {
  categoryParamsSchema,
  listCategoriesSchema,
  listCategoryProductsSchema,
} from "../validators/category.js";
import {
  getCategoryController,
  listCategoriesController,
  listCategoryProductsController,
} from "../controller/category.controller.js";

const categoriesRouter = Router();

categoriesRouter.get("/", validate(listCategoriesSchema), listCategoriesController);
categoriesRouter.get(
  "/:category_public_id/products",
  validate(listCategoryProductsSchema),
  listCategoryProductsController,
);
categoriesRouter.get(
  "/:category_public_id",
  validate(categoryParamsSchema),
  getCategoryController,
);

export { categoriesRouter };
