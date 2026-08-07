import { Router } from "express";
import { authRouter } from "../../modules/auth/index.js";
import { usersRouter } from "../../modules/users/index.js";

const v1Router = Router();

v1Router.use("/auth", authRouter);
v1Router.use("/users", usersRouter);

export { v1Router };
