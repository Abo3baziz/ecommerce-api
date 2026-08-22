import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { authentication } from "../../../middleware/authentication.js";
import { authorization } from "../../../middleware/authorization.js";
import { user_role } from "../../../generated/prisma/enums.js";
import { listAuditSchema } from "../validators/admin.js";
import { listAuditController } from "../controller/admin.controller.js";

export const adminAuditRouter = Router();

adminAuditRouter.use(authentication);
adminAuditRouter.use(authorization(user_role.SUPER_ADMIN));

adminAuditRouter.get("/", validate(listAuditSchema), listAuditController);
