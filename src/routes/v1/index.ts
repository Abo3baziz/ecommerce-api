import { Router } from "express";
import { authRouter } from "../../modules/auth/index.js";
import { addressesRouter } from "../../modules/addresses/index.js";
import { adminUsersRouter, usersRouter } from "../../modules/users/index.js";
import {
  adminProductsRouter,
  productsRouter,
} from "../../modules/products/index.js";
import {
  adminCategoriesRouter,
  categoriesRouter,
} from "../../modules/categories/index.js";
import { adminInventoryRouter } from "../../modules/inventory/index.js";
import { cartRouter } from "../../modules/cart/index.js";
import {
  adminOrdersRouter,
  ordersRouter,
} from "../../modules/orders/index.js";

const v1Router = Router();

v1Router.use("/auth", authRouter);
v1Router.use("/users", usersRouter);
v1Router.use("/users", addressesRouter);
v1Router.use("/products", productsRouter);
v1Router.use("/admin/products", adminProductsRouter);
v1Router.use("/categories", categoriesRouter);
v1Router.use("/admin/categories", adminCategoriesRouter);
v1Router.use("/admin/inventory", adminInventoryRouter);
v1Router.use("/admin/users", adminUsersRouter);
v1Router.use("/cart", cartRouter);
v1Router.use("/orders", ordersRouter);
v1Router.use("/admin/orders", adminOrdersRouter);

export { v1Router };
