export {
  productReviewsRouter,
  reviewsRouter,
} from "./routes/review.routes.js";
export { userReviewsRouter } from "./routes/user.routes.js";
export { adminReviewsRouter } from "./routes/admin.routes.js";
export {
  createReview,
  deleteReview,
  getReview,
  listOwnReviews,
  listProductReviews,
  updateReview,
} from "./service/review.service.js";
export {
  deleteReviewAdmin,
  getAdminReview,
  listAdminReviews,
  moderateReview,
} from "./service/admin.service.js";
