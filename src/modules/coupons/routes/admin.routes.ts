import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { authentication } from "../../../middleware/authentication.js";
import { authorization } from "../../../middleware/authorization.js";
import { user_role } from "../../../generated/prisma/enums.js";
import {
  couponParamsSchema,
  couponUsagesQuerySchema,
  createCouponSchema,
  listCouponsSchema,
  updateCouponSchema,
} from "../validators/admin.js";
import {
  createCouponController,
  deleteCouponController,
  getCouponController,
  getUsageHistoryController,
  listCouponsController,
  updateCouponController,
} from "../controller/admin.controller.js";

export const adminCouponsRouter = Router();

adminCouponsRouter.use(authentication);
adminCouponsRouter.use(authorization(user_role.ADMIN, user_role.SUPER_ADMIN));

adminCouponsRouter.get(
  "/",
  validate(listCouponsSchema),
  listCouponsController,
);
adminCouponsRouter.post(
  "/",
  validate(createCouponSchema),
  createCouponController,
);
adminCouponsRouter.get(
  "/:coupon_public_id",
  validate(couponParamsSchema),
  getCouponController,
);
adminCouponsRouter.patch(
  "/:coupon_public_id",
  validate(updateCouponSchema),
  updateCouponController,
);
adminCouponsRouter.delete(
  "/:coupon_public_id",
  validate(couponParamsSchema),
  deleteCouponController,
);
adminCouponsRouter.get(
  "/:coupon_public_id/usages",
  validate(couponUsagesQuerySchema),
  getUsageHistoryController,
);
