-- CreateTable
CREATE TABLE "system_settings" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" INTEGER,

    CONSTRAINT "system_settings_pk" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_unique_key" ON "system_settings"("key");

-- CreateIndex
CREATE INDEX "idx_system_settings_key" ON "system_settings"("key");

-- AddForeignKey
ALTER TABLE "system_settings" ADD CONSTRAINT "fk_system_settings_updated_by" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed defaults (idempotent)
INSERT INTO "system_settings" ("key", "value", "updated_at") VALUES
  ('general', '{"store_name":"Ecommerce Store","store_description":"","contact_email":"support@example.com","support_phone":"","store_address":"","default_language":"en","default_currency":"USD","timezone":"UTC","date_format":"YYYY-MM-DD","maintenance_mode":false,"store_active":true,"logo_url":null}'::jsonb, NOW()),
  ('commerce', '{"vat_enabled":false,"default_tax_rate":"0.00","tax_mode":"exclusive","min_order_amount":"0.00","max_order_amount":"999999.00","free_shipping_threshold":"500.00","allow_guest_checkout":true,"allow_customer_registration":true,"allow_multiple_addresses":true,"order_cancellation_window_hours":24,"return_window_days":14,"refund_window_days":14,"low_stock_threshold":5}'::jsonb, NOW()),
  ('payment', '{"enabled_methods":["cod","card"],"cod_enabled":true,"card_enabled":true,"provider":"manual","provider_config":{},"test_mode":true,"currency_restrictions":[],"payment_failure_behavior":"fail","min_transaction":"1.00","max_transaction":"99999.00"}'::jsonb, NOW()),
  ('shipping', '{"enabled_methods":["standard"],"zones":[],"rates":[],"free_shipping_rules":{},"estimated_delivery":{"min_days":3,"max_days":7},"default_method":"standard","provider_config":{}}'::jsonb, NOW()),
  ('email', '{"sender_name":"Ecommerce Store","sender_email":"no-reply@example.com","provider":"resend","provider_config":{},"notifications":{"order_placed":true,"order_confirmed":true,"order_shipped":true,"order_delivered":true,"order_cancelled":true,"refund_issued":true,"password_reset":true,"new_registration":true,"low_inventory":true,"new_review":true,"admin_security_alert":true}}'::jsonb, NOW()),
  ('customer', '{"allow_registration":true,"require_email_verification":false,"require_phone_verification":false,"password_min_length":8,"password_requirements":{"upper":true,"lower":true,"digit":true,"special":true},"session_duration_ms":2592000000,"max_active_sessions":5,"allow_account_deletion":true,"allow_reviews":true,"review_moderation":"auto","purchase_gated_reviews":false}'::jsonb, NOW()),
  ('security', '{"session_timeout_ms":1209600000,"admin_session_duration_ms":43200000,"max_login_attempts":5,"lockout_duration_ms":900000,"rate_limit":{"window_ms":60000,"max":100},"password_policy":{"min_length":8,"require_upper":true,"require_lower":true,"require_digit":true,"require_special":true},"require_email_verification":false,"require_2fa_admins":false,"login_notifications":false,"suspicious_login_alerts":true}'::jsonb, NOW()),
  ('admin_permissions', '{"invite_enabled":true,"require_2fa":false,"force_password_reset":false,"max_admins":50,"last_login_tracking":true,"active_sessions_tracking":true}'::jsonb, NOW()),
  ('financial', '{"default_currency":"USD","tax_config":{"mode":"exclusive","rate":"0.00"},"payment_fee":{"fixed":"0.00","percent":"0.00"},"refund_accounting":"credit","coupon_cost_attribution":"discount","default_reporting_period":"month","fiscal_year_start":1,"report_preferences":{"granularity":"auto","currency":"USD"},"expense_categories":["RENT","SALARIES","MARKETING","UTILITIES","SHIPPING","SOFTWARE","OTHER"]}'::jsonb, NOW())
ON CONFLICT ("key") DO NOTHING;
