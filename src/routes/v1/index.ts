import { Router } from "express";
import { authRouter } from "../../modules/auth/index.js";
import { addressesRouter } from "../../modules/addresses/index.js";

const v1Router = Router();

v1Router.use("/auth", authRouter);
v1Router.use("/users", addressesRouter);

export { v1Router };
