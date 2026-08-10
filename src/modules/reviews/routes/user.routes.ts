import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { authentication } from "../../../middleware/authentication.js";
import { listOwnReviewsSchema } from "../validators/review.js";
import { listOwnReviewsController } from "../controller/review.controller.js";

export const userReviewsRouter = Router();

userReviewsRouter.get(
  "/me/reviews",
  authentication,
  validate(listOwnReviewsSchema),
  listOwnReviewsController,
);
