import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import {
  listProductsSchema,
  productParamsSchema,
} from "../validators/product.js";
import {
  getProductController,
  listProductsController,
} from "../controller/product.controller.js";

const productsRouter = Router();

productsRouter.get("/", validate(listProductsSchema), listProductsController);
productsRouter.get("/:product_public_id", validate(productParamsSchema), getProductController);

export { productsRouter };
