import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { authentication } from "../../../middleware/authentication.js";
import {
  createReviewSchema,
  listProductReviewsSchema,
  reviewParamsSchema,
  updateReviewSchema,
} from "../validators/review.js";
import {
  createReviewController,
  deleteReviewController,
  getReviewController,
  listProductReviewsController,
  updateReviewController,
} from "../controller/review.controller.js";

export const productReviewsRouter = Router();

productReviewsRouter.get(
  "/:product_public_id/reviews",
  validate(listProductReviewsSchema),
  listProductReviewsController,
);

export const reviewsRouter = Router();

reviewsRouter.get(
  "/:review_public_id",
  validate(reviewParamsSchema),
  getReviewController,
);
reviewsRouter.post("/", authentication, validate(createReviewSchema), createReviewController);
reviewsRouter.patch(
  "/:review_public_id",
  authentication,
  validate(updateReviewSchema),
  updateReviewController,
);
reviewsRouter.delete(
  "/:review_public_id",
  authentication,
  validate(reviewParamsSchema),
  deleteReviewController,
);
