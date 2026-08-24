-- Invariant backstop indexes (T-041/T-042/T-043): DB-level enforcement for
-- invariants previously guarded only by application logic.

-- T-041: at most one primary image per product.
CREATE UNIQUE INDEX "uq_product_images_one_primary_per_product"
  ON "product_images" ("products_id")
  WHERE "is_primary";

-- T-042: at most one default address per user per type (live rows only).
CREATE UNIQUE INDEX "uq_user_addresses_one_default_shipping_per_user"
  ON "user_addresses" ("users_id")
  WHERE "is_default_shipping" AND "deleted_at" IS NULL;

CREATE UNIQUE INDEX "uq_user_addresses_one_default_billing_per_user"
  ON "user_addresses" ("users_id")
  WHERE "is_default_billing" AND "deleted_at" IS NULL;

-- T-043: at most one live review per user per product (soft-deleted reviews
-- free the pair for re-review).
CREATE UNIQUE INDEX "uq_reviews_one_live_review_per_user_product"
  ON "reviews" ("users_id", "products_id")
  WHERE "deleted_at" IS NULL;
