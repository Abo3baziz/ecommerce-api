-- Baseline migration: full schema as of 2026-08-24, including DB-level check constraints.
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "Ecommerce";

-- CreateEnum
CREATE TYPE "discount_type" AS ENUM ('FIXED_AMOUNT', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "order_status" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('PENDING', 'AUTHORIZED', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "product_status" AS ENUM ('ACTIVE', 'DRAFT', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "session_status" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('CUSTOMER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "user_status" AS ENUM ('ACTIVE', 'SUSPENDED', 'DELETED');

-- CreateEnum
CREATE TYPE "verification_type" AS ENUM ('REGISTER_EMAIL', 'CHANGE_EMAIL', 'PASSWORD_RESET', 'CHANGE_PHONE_NUMBER');

-- CreateEnum
CREATE TYPE "expense_category" AS ENUM ('RENT', 'SALARIES', 'MARKETING', 'UTILITIES', 'SHIPPING', 'SOFTWARE', 'OTHER');

-- CreateTable
CREATE TABLE "cart_items" (
    "id" SERIAL NOT NULL,
    "quantity" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "carts_id" INTEGER NOT NULL,
    "product_variants_id" INTEGER NOT NULL,

    CONSTRAINT "cart_items_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" SERIAL NOT NULL,
    "public_id" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "users_id" INTEGER NOT NULL,

    CONSTRAINT "carts_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "public_id" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "category_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupon_usages" (
    "id" SERIAL NOT NULL,
    "discount_amount" DECIMAL(10,2) NOT NULL,
    "redeemed_at" TIMESTAMPTZ(6) NOT NULL,
    "users_id" INTEGER NOT NULL,
    "coupons_id" INTEGER NOT NULL,
    "orders_id" INTEGER NOT NULL,

    CONSTRAINT "coupon_usages_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "coupons" (
    "id" SERIAL NOT NULL,
    "public_id" VARCHAR(50) NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "discount_type" "discount_type" NOT NULL,
    "discount_value" DECIMAL(10,2) NOT NULL,
    "minimum_order_amount" DECIMAL(10,2),
    "maximum_discount_amount" DECIMAL(10,2),
    "usage_limit" INTEGER NOT NULL,
    "usage_limit_per_user" INTEGER NOT NULL,
    "usage_count" INTEGER NOT NULL,
    "starts_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "coupons_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory" (
    "id" SERIAL NOT NULL,
    "quantity_on_hand" INTEGER NOT NULL,
    "reorder_level" INTEGER,
    "quantity_reserved" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "last_stock_update" TIMESTAMPTZ(6) NOT NULL,
    "product_variants_id" INTEGER NOT NULL,

    CONSTRAINT "inventory_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "orders_id" INTEGER NOT NULL,
    "product_variants_id" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "product_name" VARCHAR(255) NOT NULL,
    "product_slug" VARCHAR(255) NOT NULL,
    "sku" VARCHAR(100) NOT NULL,
    "variant_color" VARCHAR(100),
    "variant_size" VARCHAR(100),
    "variant_weight" DECIMAL(10,2),
    "variant_width" DECIMAL(10,2),
    "variant_length" DECIMAL(10,2),
    "variant_height" DECIMAL(10,2),
    "discount_percentage" DECIMAL(5,2),

    CONSTRAINT "order_items_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "public_id" VARCHAR(50) NOT NULL,
    "status" "order_status" NOT NULL,
    "shipping_cost" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "order_number" VARCHAR(50) NOT NULL,
    "discount_amount" DECIMAL(10,2) NOT NULL,
    "shipping_fee" DECIMAL(10,2) NOT NULL,
    "tax_amount" DECIMAL(10,2) NOT NULL,
    "total_amount" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "placed_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "users_id" INTEGER NOT NULL,
    "coupons_id" INTEGER,
    "user_addresses_id" INTEGER NOT NULL,

    CONSTRAINT "orders_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" SERIAL NOT NULL,
    "public_id" VARCHAR(50) NOT NULL,
    "token_hash" VARCHAR(255),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "users_id" INTEGER NOT NULL,

    CONSTRAINT "password_reset_tokens_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" SERIAL NOT NULL,
    "public_id" VARCHAR(50) NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "payment_method" VARCHAR(50) NOT NULL,
    "status" "payment_status" NOT NULL,
    "transaction_reference" VARCHAR(255),
    "paid_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "users_id" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "failed_at" TIMESTAMPTZ(6),
    "refunded_at" TIMESTAMPTZ(6),
    "orders_id" INTEGER NOT NULL,

    CONSTRAINT "payments_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "categories_id" INTEGER NOT NULL,
    "products_id" INTEGER NOT NULL,

    CONSTRAINT "product_categories_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_images" (
    "id" SERIAL NOT NULL,
    "products_id" INTEGER NOT NULL,
    "public_id" VARCHAR(50) NOT NULL,
    "image_url" VARCHAR(2048) NOT NULL,
    "is_primary" BOOLEAN NOT NULL,
    "display_order" INTEGER NOT NULL,
    "alt_text" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "product_images_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variant_images" (
    "id" SERIAL NOT NULL,
    "public_id" VARCHAR(50) NOT NULL,
    "image_url" VARCHAR(2048) NOT NULL,
    "product_variants_id" INTEGER NOT NULL,
    "display_order" INTEGER NOT NULL,
    "alt_text" VARCHAR(255),

    CONSTRAINT "product_variant_images_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_variants" (
    "id" SERIAL NOT NULL,
    "public_id" VARCHAR(50) NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "discount_percentage" DECIMAL(5,2),
    "color" VARCHAR(50),
    "size" VARCHAR(50),
    "status" "product_status",
    "sku" VARCHAR(80) NOT NULL,
    "barcode" TEXT,
    "cost_price" DECIMAL(10,2),
    "weight" DECIMAL(10,2),
    "width" DECIMAL(10,2),
    "height" DECIMAL(10,2),
    "length" DECIMAL(10,2),
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "products_id" INTEGER NOT NULL,

    CONSTRAINT "product_variants_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "public_id" VARCHAR(50) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "brand" VARCHAR(255),
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "products_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_images" (
    "id" SERIAL NOT NULL,
    "image_url" TEXT NOT NULL,
    "alt_text" VARCHAR(255),
    "display_order" INTEGER,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "reviews_id" INTEGER,
    "public_id" VARCHAR(50) NOT NULL,

    CONSTRAINT "review_images_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" SERIAL NOT NULL,
    "public_id" VARCHAR(50) NOT NULL,
    "rating" SMALLINT NOT NULL,
    "title" VARCHAR(255),
    "comment" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "is_approved" BOOLEAN NOT NULL DEFAULT true,
    "users_id" INTEGER NOT NULL,
    "products_id" INTEGER NOT NULL,

    CONSTRAINT "reviews_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" SERIAL NOT NULL,
    "public_id" VARCHAR(32) NOT NULL,
    "refresh_token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "last_activity_at" TIMESTAMPTZ(6),
    "ip_address" INET,
    "user_agent" TEXT,
    "device_name" VARCHAR(100),
    "country" VARCHAR(100),
    "city" VARCHAR(100),
    "is_current" BOOLEAN NOT NULL,
    "users_id" INTEGER NOT NULL,

    CONSTRAINT "sessions_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" SERIAL NOT NULL,
    "public_id" VARCHAR(50) NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "carrier" VARCHAR(100),
    "tracking_number" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "shipped_at" TIMESTAMPTZ(6),
    "delivered_at" TIMESTAMPTZ(6),
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "orders_id" INTEGER NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    "recipient_name" VARCHAR(100) NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "country" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100),
    "city" VARCHAR(100) NOT NULL,
    "address_1" VARCHAR(100) NOT NULL,
    "address_2" VARCHAR(100),
    "postal_code" VARCHAR(20),

    CONSTRAINT "shipments_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_addresses" (
    "id" SERIAL NOT NULL,
    "public_id" VARCHAR(50) NOT NULL,
    "recipient_name" VARCHAR(100) NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "label" VARCHAR(50),
    "country" VARCHAR(100) NOT NULL,
    "state" VARCHAR(100) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "address_1" TEXT NOT NULL,
    "address_2" TEXT,
    "zip_code" VARCHAR(20),
    "users_id" INTEGER NOT NULL,
    "is_default_shipping" BOOLEAN NOT NULL DEFAULT true,
    "is_default_billing" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_addresses_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "public_id" VARCHAR(32) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "phone_number" VARCHAR(20) NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "email_verified_at" TIMESTAMP(6),
    "phone_verified_at" TIMESTAMP(6),
    "role" "user_role" NOT NULL,
    "status" "user_status" NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "id" SERIAL NOT NULL,
    "public_id" VARCHAR(32) NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "target" VARCHAR(100) NOT NULL,
    "purpose" "verification_type",
    "verified_at" TIMESTAMPTZ(6),
    "users_id" INTEGER NOT NULL,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "channel" VARCHAR(10),

    CONSTRAINT "verification_tokens_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "public_id" VARCHAR(32) NOT NULL,
    "actor_users_id" INTEGER,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50),
    "entity_public_id" VARCHAR(50),
    "method" VARCHAR(10),
    "path" VARCHAR(255),
    "status_code" INTEGER NOT NULL,
    "request_body" JSONB,
    "previous_values" JSONB,
    "changes" JSONB,
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "audit_logs_pk" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operating_expenses" (
    "id" SERIAL NOT NULL,
    "public_id" VARCHAR(32) NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "category" "expense_category" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "spent_at" DATE NOT NULL,
    "created_by_users_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "operating_expenses_pk" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_cart_items_cart_id" ON "cart_items"("carts_id");

-- CreateIndex
CREATE INDEX "idx_cart_items_product_variant_id" ON "cart_items"("product_variants_id");

-- CreateIndex
CREATE UNIQUE INDEX "carts_public_id_unique_key" ON "carts"("public_id");

-- CreateIndex
CREATE INDEX "idx_carts_public_id" ON "carts"("public_id");

-- CreateIndex
CREATE INDEX "idx_carts_user_id" ON "carts"("users_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_public_id_unique_key" ON "categories"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_unique_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_unique_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "idx_categories_name" ON "categories"("name");

-- CreateIndex
CREATE INDEX "idx_categories_public_id" ON "categories"("public_id");

-- CreateIndex
CREATE INDEX "idx_categories_slug" ON "categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_usages__unique_key" ON "coupon_usages"("orders_id");

-- CreateIndex
CREATE INDEX "idx_coupon_usages_coupon_id" ON "coupon_usages"("coupons_id");

-- CreateIndex
CREATE INDEX "idx_coupon_usages_order_id" ON "coupon_usages"("orders_id");

-- CreateIndex
CREATE INDEX "idx_coupon_usages_redeemed_at" ON "coupon_usages"("redeemed_at");

-- CreateIndex
CREATE INDEX "idx_coupon_usages_user_id" ON "coupon_usages"("users_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_public_id_unique_key" ON "coupons"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupons_code_unique_key" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "idx_coupons_code" ON "coupons"("code");

-- CreateIndex
CREATE INDEX "idx_coupons_expires_at" ON "coupons"("expires_at");

-- CreateIndex
CREATE INDEX "idx_coupons_is_active" ON "coupons"("is_active");

-- CreateIndex
CREATE INDEX "idx_coupons_public_id" ON "coupons"("public_id");

-- CreateIndex
CREATE INDEX "idx_coupons_starts_at" ON "coupons"("starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "inventory__unique_key" ON "inventory"("product_variants_id");

-- CreateIndex
CREATE INDEX "idx_inventory_product_variant_id" ON "inventory"("product_variants_id");

-- CreateIndex
CREATE INDEX "idx_order_items_order_id" ON "order_items"("orders_id");

-- CreateIndex
CREATE INDEX "idx_order_items_product_variant_id" ON "order_items"("product_variants_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_public_id_unique_key" ON "orders"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_unique_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "idx_orders_coupon_id" ON "orders"("coupons_id");

-- CreateIndex
CREATE INDEX "idx_orders_order_number" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "idx_orders_placed_at" ON "orders"("placed_at");

-- CreateIndex
CREATE INDEX "idx_orders_public_id" ON "orders"("public_id");

-- CreateIndex
CREATE INDEX "idx_orders_status" ON "orders"("status");

-- CreateIndex
CREATE INDEX "idx_orders_user_address_id" ON "orders"("user_addresses_id");

-- CreateIndex
CREATE INDEX "idx_orders_user_id" ON "orders"("users_id");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_public_id_unique_key" ON "password_reset_tokens"("public_id");

-- CreateIndex
CREATE INDEX "idx_password_reset_tokens_expires_at" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "idx_password_reset_tokens_public_id" ON "password_reset_tokens"("public_id");

-- CreateIndex
CREATE INDEX "idx_password_reset_tokens_token_hash" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_password_reset_tokens_user_id" ON "password_reset_tokens"("users_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_public_id_unique_key" ON "payments"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transaction_reference_unique_key" ON "payments"("transaction_reference");

-- CreateIndex
CREATE UNIQUE INDEX "payments__unique_key" ON "payments"("orders_id");

-- CreateIndex
CREATE INDEX "idx_payments_order_id" ON "payments"("orders_id");

-- CreateIndex
CREATE INDEX "idx_payments_paid_at" ON "payments"("paid_at");

-- CreateIndex
CREATE INDEX "idx_payments_public_id" ON "payments"("public_id");

-- CreateIndex
CREATE INDEX "idx_payments_status" ON "payments"("status");

-- CreateIndex
CREATE INDEX "idx_payments_transaction_reference" ON "payments"("transaction_reference");

-- CreateIndex
CREATE INDEX "idx_product_categories_category_id" ON "product_categories"("categories_id");

-- CreateIndex
CREATE INDEX "idx_product_categories_product_id" ON "product_categories"("products_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_product_id_category_id_unique_key" ON "product_categories"("categories_id", "products_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_images_public_id_unique_key" ON "product_images"("public_id");

-- CreateIndex
CREATE INDEX "idx_product_images_display_order" ON "product_images"("display_order");

-- CreateIndex
CREATE INDEX "idx_product_images_product_id" ON "product_images"("products_id");

-- CreateIndex
CREATE INDEX "idx_product_images_public_id" ON "product_images"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_variant_images_public_id_unique_key" ON "product_variant_images"("public_id");

-- CreateIndex
CREATE INDEX "idx_product_variant_images_display_order" ON "product_variant_images"("display_order");

-- CreateIndex
CREATE INDEX "idx_product_variant_images_product_variant_id" ON "product_variant_images"("product_variants_id");

-- CreateIndex
CREATE INDEX "idx_product_variant_images_public_id" ON "product_variant_images"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_public_id_unique_key" ON "product_variants"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_variants_sku_unique_key" ON "product_variants"("sku");

-- CreateIndex
CREATE INDEX "idx_product_variants_price" ON "product_variants"("price");

-- CreateIndex
CREATE INDEX "idx_product_variants_product_id" ON "product_variants"("products_id");

-- CreateIndex
CREATE INDEX "idx_product_variants_public_id" ON "product_variants"("public_id");

-- CreateIndex
CREATE INDEX "idx_product_variants_sku" ON "product_variants"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "products_public_id_unique_key" ON "products"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_slug_unique_key" ON "products"("slug");

-- CreateIndex
CREATE INDEX "idx_products_brand" ON "products"("brand");

-- CreateIndex
CREATE INDEX "idx_products_name" ON "products"("name");

-- CreateIndex
CREATE INDEX "idx_products_public_id" ON "products"("public_id");

-- CreateIndex
CREATE INDEX "idx_products_slug" ON "products"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "review_images_public_id_unique_key" ON "review_images"("public_id");

-- CreateIndex
CREATE INDEX "idx_review_images_display_order" ON "review_images"("display_order");

-- CreateIndex
CREATE INDEX "idx_review_images_public_id" ON "review_images"("public_id");

-- CreateIndex
CREATE INDEX "idx_review_images_review_id" ON "review_images"("reviews_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_public_id_unique_key" ON "reviews"("public_id");

-- CreateIndex
CREATE INDEX "idx_reviews_is_approved" ON "reviews"("is_approved");

-- CreateIndex
CREATE INDEX "idx_reviews_product_id" ON "reviews"("products_id");

-- CreateIndex
CREATE INDEX "idx_reviews_public_id" ON "reviews"("public_id");

-- CreateIndex
CREATE INDEX "idx_reviews_rating" ON "reviews"("rating");

-- CreateIndex
CREATE INDEX "idx_reviews_user_id" ON "reviews"("users_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_public_id_unique_key" ON "sessions"("public_id");

-- CreateIndex
CREATE INDEX "idx_sessions_expires_at" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "idx_sessions_public_id" ON "sessions"("public_id");

-- CreateIndex
CREATE INDEX "idx_sessions_refresh_token_hash" ON "sessions"("refresh_token_hash");

-- CreateIndex
CREATE INDEX "idx_sessions_user_id" ON "sessions"("users_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_public_id_unique_key" ON "shipments"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_tracking_number_unique_key" ON "shipments"("tracking_number");

-- CreateIndex
CREATE UNIQUE INDEX "shipments__unique_key" ON "shipments"("orders_id");

-- CreateIndex
CREATE INDEX "idx_shipments_order_id" ON "shipments"("orders_id");

-- CreateIndex
CREATE INDEX "idx_shipments_public_id" ON "shipments"("public_id");

-- CreateIndex
CREATE INDEX "idx_shipments_status" ON "shipments"("status");

-- CreateIndex
CREATE INDEX "idx_shipments_tracking_number" ON "shipments"("tracking_number");

-- CreateIndex
CREATE UNIQUE INDEX "user_addresses_public_id_unique_key" ON "user_addresses"("public_id");

-- CreateIndex
CREATE INDEX "idx_user_addresses_default_billing" ON "user_addresses"("is_default_billing");

-- CreateIndex
CREATE INDEX "idx_user_addresses_default_shipping" ON "user_addresses"("is_default_shipping");

-- CreateIndex
CREATE INDEX "idx_user_addresses_deleted_at" ON "user_addresses"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_user_addresses_public_id" ON "user_addresses"("public_id");

-- CreateIndex
CREATE INDEX "idx_user_addresses_user_id" ON "user_addresses"("users_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_public_id_unique_key" ON "users"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_unique_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_number_unique_key" ON "users"("phone_number");

-- CreateIndex
CREATE INDEX "idx_users_email" ON "users"("email");

-- CreateIndex
CREATE INDEX "idx_users_public_id" ON "users"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_public_id_unique_key" ON "verification_tokens"("public_id");

-- CreateIndex
CREATE INDEX "idx_verification_tokens_expires_at" ON "verification_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "idx_verification_tokens_public_id" ON "verification_tokens"("public_id");

-- CreateIndex
CREATE INDEX "idx_verification_tokens_token_hash" ON "verification_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_verification_tokens_user_id" ON "verification_tokens"("users_id");

-- CreateIndex
CREATE INDEX "idx_verification_tokens_verification_type" ON "verification_tokens"("purpose");

-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_public_id_unique_key" ON "audit_logs"("public_id");

-- CreateIndex
CREATE INDEX "idx_audit_logs_created_at" ON "audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "idx_audit_logs_actor_created_at" ON "audit_logs"("actor_users_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_audit_logs_action" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "idx_audit_logs_entity" ON "audit_logs"("entity_type", "entity_public_id");

-- CreateIndex
CREATE UNIQUE INDEX "operating_expenses_public_id_unique_key" ON "operating_expenses"("public_id");

-- CreateIndex
CREATE INDEX "idx_operating_expenses_spent_at" ON "operating_expenses"("spent_at");

-- CreateIndex
CREATE INDEX "idx_operating_expenses_category" ON "operating_expenses"("category");

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "fk_cart_items_carts" FOREIGN KEY ("carts_id") REFERENCES "carts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "fk_cart_items_product_variants" FOREIGN KEY ("product_variants_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "fk_carts_users" FOREIGN KEY ("users_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usages" ADD CONSTRAINT "fk_coupon_usages_coupons" FOREIGN KEY ("coupons_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usages" ADD CONSTRAINT "fk_coupon_usages_orders" FOREIGN KEY ("orders_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coupon_usages" ADD CONSTRAINT "fk_coupon_usages_users" FOREIGN KEY ("users_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory" ADD CONSTRAINT "fk_inventory_product_variants" FOREIGN KEY ("product_variants_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "fk_order_items_orders" FOREIGN KEY ("orders_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "fk_order_items_product_variants" FOREIGN KEY ("product_variants_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "fk_orders_coupons" FOREIGN KEY ("coupons_id") REFERENCES "coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "fk_orders_user_addresses" FOREIGN KEY ("user_addresses_id") REFERENCES "user_addresses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "fk_orders_users" FOREIGN KEY ("users_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "fk_password_reset_tokens_users" FOREIGN KEY ("users_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "fk_payments_orders" FOREIGN KEY ("orders_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "fk_payments_users" FOREIGN KEY ("users_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "fk_product_categories_categories" FOREIGN KEY ("categories_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "fk_product_categories_products" FOREIGN KEY ("products_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_images" ADD CONSTRAINT "fk_product_images_products" FOREIGN KEY ("products_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variant_images" ADD CONSTRAINT "fk_product_variant_images_product_variants" FOREIGN KEY ("product_variants_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_variants" ADD CONSTRAINT "fk_product_variants_products" FOREIGN KEY ("products_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_images" ADD CONSTRAINT "fk_review_images_reviews" FOREIGN KEY ("reviews_id") REFERENCES "reviews"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "fk_reviews_products" FOREIGN KEY ("products_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "fk_reviews_users" FOREIGN KEY ("users_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "fk_sessions_users" FOREIGN KEY ("users_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "fk_shipments_orders" FOREIGN KEY ("orders_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_addresses" ADD CONSTRAINT "fk_user_addresses_users" FOREIGN KEY ("users_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_tokens" ADD CONSTRAINT "fk_verification_tokens_users" FOREIGN KEY ("users_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "fk_audit_logs_users" FOREIGN KEY ("actor_users_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operating_expenses" ADD CONSTRAINT "fk_operating_expenses_users" FOREIGN KEY ("created_by_users_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateCheckConstraints
-- DB-level invariants that Prisma schema cannot express. These mirror the
-- constraints enforced in the original development database; see
-- tasks/T-041…T-043 for future index/invariant work.

ALTER TABLE "cart_items" ADD CONSTRAINT "ck_cart_items_quantity_positive" CHECK ((quantity >= 0));
ALTER TABLE "coupon_usages" ADD CONSTRAINT "ck_coupon_usages_discount_amount_non_negative" CHECK ((discount_amount >= (0)::numeric));
ALTER TABLE "coupons" ADD CONSTRAINT "ck_coupons_discount_value_positive" CHECK ((discount_value > (0)::numeric));
ALTER TABLE "coupons" ADD CONSTRAINT "ck_coupons_maximum_discount_amount_non_negative" CHECK (((maximum_discount_amount IS NULL) OR (maximum_discount_amount >= (0)::numeric)));
ALTER TABLE "coupons" ADD CONSTRAINT "ck_coupons_minimum_order_amount_non_negative" CHECK (((minimum_order_amount IS NULL) OR (minimum_order_amount >= (0)::numeric)));
ALTER TABLE "coupons" ADD CONSTRAINT "ck_coupons_usage_count_non_negative" CHECK ((usage_count >= 0));
ALTER TABLE "coupons" ADD CONSTRAINT "ck_coupons_usage_limit_positive" CHECK ((usage_limit > 0));
ALTER TABLE "inventory" ADD CONSTRAINT "ck_inventory_quantity_on_hand_non_negative" CHECK ((quantity_on_hand >= 0));
ALTER TABLE "inventory" ADD CONSTRAINT "ck_inventory_quantity_reserved_non_negative" CHECK ((quantity_reserved >= 0));
ALTER TABLE "inventory" ADD CONSTRAINT "ck_inventory_reorder_level_non_negative" CHECK ((reorder_level >= 0));
ALTER TABLE "inventory" ADD CONSTRAINT "ck_inventory_reserved_not_exceed_on_hand" CHECK ((quantity_reserved <= quantity_on_hand));
ALTER TABLE "order_items" ADD CONSTRAINT "ck_order_items_quantity_positive" CHECK ((quantity > 0));
ALTER TABLE "order_items" ADD CONSTRAINT "ck_order_items_total_amount_non_negative" CHECK ((total_amount >= (0)::numeric));
ALTER TABLE "order_items" ADD CONSTRAINT "ck_order_items_unit_price_non_negative" CHECK ((unit_price >= (0)::numeric));
ALTER TABLE "orders" ADD CONSTRAINT "ck_orders_discount_amount_non_negative" CHECK ((discount_amount >= (0)::numeric));
ALTER TABLE "orders" ADD CONSTRAINT "ck_orders_shipping_fee_non_negative" CHECK ((shipping_fee >= (0)::numeric));
ALTER TABLE "orders" ADD CONSTRAINT "ck_orders_subtotal_non_negative" CHECK ((subtotal >= (0)::numeric));
ALTER TABLE "orders" ADD CONSTRAINT "ck_orders_tax_amount_non_negative" CHECK ((tax_amount >= (0)::numeric));
ALTER TABLE "orders" ADD CONSTRAINT "ck_orders_total_amount_non_negative" CHECK ((total_amount >= (0)::numeric));
ALTER TABLE "payments" ADD CONSTRAINT "ck_payments_amount_positive" CHECK ((amount > (0)::numeric));
ALTER TABLE "product_variants" ADD CONSTRAINT "ck_product_variants_cost_price_non_negative" CHECK (((cost_price IS NULL) OR (cost_price >= (0)::numeric)));
ALTER TABLE "product_variants" ADD CONSTRAINT "ck_product_variants_discount_percentage_range" CHECK (((discount_percentage IS NULL) OR ((discount_percentage >= (0)::numeric) AND (discount_percentage <= (100)::numeric))));
ALTER TABLE "product_variants" ADD CONSTRAINT "ck_product_variants_height_positive" CHECK (((height IS NULL) OR (height > (0)::numeric)));
ALTER TABLE "product_variants" ADD CONSTRAINT "ck_product_variants_length_positive" CHECK (((length IS NULL) OR (length > (0)::numeric)));
ALTER TABLE "product_variants" ADD CONSTRAINT "ck_product_variants_price_non_negative" CHECK ((price >= (0)::numeric));
ALTER TABLE "product_variants" ADD CONSTRAINT "ck_product_variants_weight_positive" CHECK (((weight IS NULL) OR (weight > (0)::numeric)));
ALTER TABLE "product_variants" ADD CONSTRAINT "ck_product_variants_width_positive" CHECK (((width IS NULL) OR (width > (0)::numeric)));
ALTER TABLE "reviews" ADD CONSTRAINT "ck_reviews_rating_range" CHECK (((rating >= 1) AND (rating <= 5)));
ALTER TABLE "shipments" ADD CONSTRAINT "ck_shipments_delivered_at_after_shipped_at" CHECK (((delivered_at IS NULL) OR (shipped_at IS NULL) OR (delivered_at >= shipped_at)));
ALTER TABLE "shipments" ADD CONSTRAINT "ck_shipments_delivered_requires_shipped" CHECK ((((status)::text <> 'DELIVERED'::text) OR (shipped_at IS NOT NULL)));

