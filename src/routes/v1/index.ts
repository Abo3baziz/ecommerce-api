import { Router } from "express";
import { authRouter } from "../../modules/auth/index.js";
import { addressesRouter } from "../../modules/addresses/index.js";
import { usersRouter } from "../../modules/users/index.js";
import {
  adminProductsRouter,
  productsRouter,
} from "../../modules/products/index.js";

const v1Router = Router();

v1Router.use("/auth", authRouter);
v1Router.use("/users", usersRouter);
v1Router.use("/users", addressesRouter);
v1Router.use("/products", productsRouter);
v1Router.use("/admin/products", adminProductsRouter);

export { v1Router };
