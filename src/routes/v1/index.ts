import { Router } from "express";
import { csrfProtection } from "../../middleware/csrf.js";
import { env } from "../../config/env.js";
import { authRouter } from "../../modules/auth/index.js";
import { addressesRouter } from "../../modules/addresses/index.js";
import { adminUsersRouter, usersRouter } from "../../modules/users/index.js";
import {
  adminProductsRouter,
  productsRouter,
} from "../../modules/products/index.js";
import {
  adminCategoriesRouter,
  categoriesRouter,
} from "../../modules/categories/index.js";
import { adminInventoryRouter } from "../../modules/inventory/index.js";
import { cartRouter } from "../../modules/cart/index.js";
import {
  adminOrdersRouter,
  ordersRouter,
} from "../../modules/orders/index.js";
import {
  adminReviewsRouter,
  productReviewsRouter,
  reviewsRouter,
  userReviewsRouter,
} from "../../modules/reviews/index.js";
import { uploadsRouter } from "../../modules/uploads/index.js";
import { adminStatsRouter } from "../../modules/stats/index.js";
import { adminAuditRouter } from "../../modules/audit/index.js";
import { adminAnalyticsRouter } from "../../modules/analytics/index.js";
import { adminCouponsRouter } from "../../modules/coupons/index.js";
import { adminAccountsRouter } from "../../modules/admins/index.js";
import { adminReportsRouter } from "../../modules/reports/index.js";
import { auditAdminMutations } from "../../middleware/auditLog.js";

const v1Router = Router();

// CSRF validation is environment-toggled (ENABLE_CSRF, default true).
// Token GENERATION (/auth/csrf-token) stays available in every mode so the
// frontend flow is identical either way.
if (env.ENABLE_CSRF) {
  v1Router.use(csrfProtection);
}
// Mounted before the admin routers: snapshots the request body pre-validation
// and writes one audit row per authenticated mutating /admin/* request.
v1Router.use("/admin", auditAdminMutations);

v1Router.use("/auth", authRouter);
v1Router.use("/users", usersRouter);
v1Router.use("/users", addressesRouter);
v1Router.use("/products", productsRouter);
v1Router.use("/admin/products", adminProductsRouter);
v1Router.use("/categories", categoriesRouter);
v1Router.use("/admin/categories", adminCategoriesRouter);
v1Router.use("/admin/inventory", adminInventoryRouter);
v1Router.use("/admin/users", adminUsersRouter);
v1Router.use("/cart", cartRouter);
v1Router.use("/orders", ordersRouter);
v1Router.use("/admin/orders", adminOrdersRouter);
v1Router.use("/products", productReviewsRouter);
v1Router.use("/reviews", reviewsRouter);
v1Router.use("/users", userReviewsRouter);
v1Router.use("/admin/reviews", adminReviewsRouter);
v1Router.use("/admin/stats", adminStatsRouter);
v1Router.use("/admin/audit", adminAuditRouter);
v1Router.use("/admin/analytics", adminAnalyticsRouter);
v1Router.use("/admin/coupons", adminCouponsRouter);
v1Router.use("/admin/admins", adminAccountsRouter);
v1Router.use("/admin/reports", adminReportsRouter);
v1Router.use("/uploads", uploadsRouter);

export { v1Router };
