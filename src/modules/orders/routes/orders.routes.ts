import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { authentication } from "../../../middleware/authentication.js";
import {
  listOrdersSchema,
  orderParamsSchema,
  placeOrderSchema,
} from "../validators/orders.js";
import {
  getOrderController,
  listOrdersController,
  placeOrderController,
} from "../controller/orders.controller.js";

const ordersRouter = Router();

ordersRouter.use(authentication);

ordersRouter.post("/", validate(placeOrderSchema), placeOrderController);
ordersRouter.get("/", validate(listOrdersSchema), listOrdersController);
ordersRouter.get(
  "/:order_public_id",
  validate(orderParamsSchema),
  getOrderController,
);

export { ordersRouter };
