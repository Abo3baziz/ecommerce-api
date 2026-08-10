import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { authentication } from "../../../middleware/authentication.js";
import { authorization } from "../../../middleware/authorization.js";
import { user_role } from "../../../generated/prisma/enums.js";
import {
  adminReviewParamsSchema,
  listAdminReviewsSchema,
  moderateReviewSchema,
} from "../validators/admin.js";
import {
  deleteReviewAdminController,
  getAdminReviewController,
  listAdminReviewsController,
  moderateReviewController,
} from "../controller/admin.controller.js";

export const adminReviewsRouter = Router();

adminReviewsRouter.use(authentication);
adminReviewsRouter.use(authorization(user_role.ADMIN, user_role.SUPER_ADMIN));

adminReviewsRouter.get(
  "/",
  validate(listAdminReviewsSchema),
  listAdminReviewsController,
);
adminReviewsRouter.get(
  "/:review_public_id",
  validate(adminReviewParamsSchema),
  getAdminReviewController,
);
adminReviewsRouter.patch(
  "/:review_public_id",
  validate(moderateReviewSchema),
  moderateReviewController,
);
adminReviewsRouter.delete(
  "/:review_public_id",
  validate(adminReviewParamsSchema),
  deleteReviewAdminController,
);
