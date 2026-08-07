import { Router } from "express";
import { authRouter } from "../../modules/auth/index.js";

const v1Router = Router();

v1Router.use("/auth", authRouter);

export { v1Router };
