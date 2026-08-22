import { Router } from "express";
import { authentication } from "../../../middleware/authentication.js";
import { getImageKitAuthParamsController } from "../controller/upload.controller.js";

export const uploadsRouter = Router();

uploadsRouter.use(authentication);

uploadsRouter.get("/imagekit-auth", getImageKitAuthParamsController);
