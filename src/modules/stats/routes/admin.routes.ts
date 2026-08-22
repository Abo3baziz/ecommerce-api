import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { authentication } from "../../../middleware/authentication.js";
import { authorization } from "../../../middleware/authorization.js";
import { user_role } from "../../../generated/prisma/enums.js";
import { getAdminStatsSchema } from "../validators/admin.js";
import { getAdminStatsController } from "../controller/admin.controller.js";

export const adminStatsRouter = Router();

adminStatsRouter.use(authentication);
adminStatsRouter.use(authorization(user_role.ADMIN, user_role.SUPER_ADMIN));

adminStatsRouter.get("/", validate(getAdminStatsSchema), getAdminStatsController);
