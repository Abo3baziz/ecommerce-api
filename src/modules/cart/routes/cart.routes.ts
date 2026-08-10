import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { authentication } from "../../../middleware/authentication.js";
import {
  addCartItemSchema,
  cartItemParamsSchema,
  updateCartItemSchema,
} from "../validators/cart.js";
import {
  addCartItemController,
  clearCartController,
  getCartController,
  removeCartItemController,
  updateCartItemController,
} from "../controller/cart.controller.js";

const cartRouter = Router();

cartRouter.use(authentication);

cartRouter.get("/", getCartController);
cartRouter.post("/items", validate(addCartItemSchema), addCartItemController);
cartRouter.patch(
  "/items/:variant_public_id",
  validate(updateCartItemSchema),
  updateCartItemController,
);
cartRouter.delete(
  "/items/:variant_public_id",
  validate(cartItemParamsSchema),
  removeCartItemController,
);
cartRouter.delete("/", clearCartController);

export { cartRouter };
