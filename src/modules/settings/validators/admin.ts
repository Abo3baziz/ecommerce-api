import { z } from "zod";

function decimalField(maxInt: number, maxDec: number, min: number, max?: number) {
  const pattern = new RegExp(`^\\d{1,${maxInt}}(\\.\\d{1,${maxDec}})?$`);
  return z
    .string()
    .trim()
    .refine(
      (v) => {
        if (!pattern.test(v)) return false;
        const n = Number(v);
        if (n < min) return false;
        if (max !== undefined && n > max) return false;
        return true;
      },
      { message: "Invalid decimal value" },
    );
}
const moneyField = decimalField(10, 2, 0);
const percentField = decimalField(5, 2, 0, 100);

export const SETTINGS_KEYS = [
  "general",
  "commerce",
  "payment",
  "shipping",
  "email",
  "customer",
  "security",
  "admin_permissions",
  "financial",
] as const;

export const settingsKeySchema = z.enum(SETTINGS_KEYS);

export const getSettingsSchema = z.object({
  query: z.object({
    section: settingsKeySchema.optional(),
  }),
});

export type GetSettingsQuery = z.infer<typeof getSettingsSchema.shape.query>;

// --- General ---
export const patchGeneralSchema = z.object({
  params: z.object({ section: z.literal("general") }),
  body: z.object({
    store_name: z.string().trim().min(1).max(100),
    store_description: z.string().trim().max(5000).optional().or(z.literal("")),
    contact_email: z.string().trim().email().max(320),
    support_phone: z.string().trim().max(20).optional().or(z.literal("")),
    store_address: z.string().trim().max(500).optional().or(z.literal("")),
    default_language: z.enum(["en", "ar", "fr", "de", "es", "tr"]).default("en"),
    default_currency: z.enum(["USD", "EUR", "GBP", "EGP", "SAR", "AED"]).default("USD"),
    timezone: z.string().trim().min(1).max(100).default("UTC"),
    date_format: z.enum(["YYYY-MM-DD", "DD/MM/YYYY", "MM/DD/YYYY"]).default("YYYY-MM-DD"),
    maintenance_mode: z.boolean().default(false),
    store_active: z.boolean().default(true),
    logo_url: z.string().trim().url().optional().or(z.literal("")).or(z.null()),
  }),
});

// --- Commerce ---
export const patchCommerceSchema = z.object({
  params: z.object({ section: z.literal("commerce") }),
  body: z
    .object({
      vat_enabled: z.boolean().default(false),
      default_tax_rate: percentField.default("0.00"),
      tax_mode: z.enum(["inclusive", "exclusive"]).default("exclusive"),
      min_order_amount: moneyField.default("0.00"),
      max_order_amount: moneyField.default("999999.00"),
      free_shipping_threshold: moneyField.default("500.00"),
      allow_guest_checkout: z.boolean().default(true),
      allow_customer_registration: z.boolean().default(true),
      allow_multiple_addresses: z.boolean().default(true),
      order_cancellation_window_hours: z.coerce.number().int().min(0).max(168).default(24),
      return_window_days: z.coerce.number().int().min(0).max(90).default(14),
      refund_window_days: z.coerce.number().int().min(0).max(90).default(14),
      low_stock_threshold: z.coerce.number().int().min(1).max(10000).default(5),
    })
    .superRefine((data, ctx) => {
      if (Number(data.min_order_amount) > Number(data.max_order_amount)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["max_order_amount"], message: "max must be >= min" });
      }
    }),
});

// --- Payment ---
export const patchPaymentSchema = z.object({
  params: z.object({ section: z.literal("payment") }),
  body: z
    .object({
      enabled_methods: z.array(z.enum(["cod", "card"])).default(["cod", "card"]),
      cod_enabled: z.boolean().default(true),
      card_enabled: z.boolean().default(true),
      provider: z.enum(["manual", "stripe", "paymob"]).default("manual"),
      provider_config: z.record(z.string(), z.unknown()).default({}),
      provider_secret_key: z.string().max(2000).optional().or(z.literal("__REDACTED__")).or(z.literal("[redacted]")),
      webhook_secret: z.string().max(2000).optional().or(z.literal("__REDACTED__")).or(z.literal("[redacted]")),
      test_mode: z.boolean().default(true),
      currency_restrictions: z.array(z.enum(["USD", "EUR", "GBP", "EGP", "SAR", "AED"])).default([]),
      payment_failure_behavior: z.enum(["retry", "hold", "fail"]).default("fail"),
      min_transaction: moneyField.default("1.00"),
      max_transaction: moneyField.default("99999.00"),
    })
    .superRefine((data, ctx) => {
      if (Number(data.min_transaction) > Number(data.max_transaction)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["max_transaction"], message: "max must be >= min" });
      }
    }),
});

// --- Shipping ---
export const patchShippingSchema = z.object({
  params: z.object({ section: z.literal("shipping") }),
  body: z.object({
    enabled_methods: z.array(z.string().trim().min(1).max(50)).default(["standard"]),
    zones: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(100),
          countries: z.array(z.string().trim().min(1).max(100)).default([]),
          regions: z.array(z.string().trim().min(1).max(100)).default([]),
        }),
      )
      .default([]),
    rates: z
      .array(
        z.object({
          zone: z.string().trim().min(1).max(100),
          weight_max: z.string().trim().optional().or(z.literal("")),
          price: moneyField,
        }),
      )
      .default([]),
    free_shipping_rules: z.record(z.string(), z.unknown()).default({}),
    estimated_delivery: z
      .object({ min_days: z.coerce.number().int().min(0).max(60).default(3), max_days: z.coerce.number().int().min(0).max(60).default(7) })
      .default({ min_days: 3, max_days: 7 }),
    default_method: z.string().trim().min(1).max(50).default("standard"),
    provider_config: z.record(z.string(), z.unknown()).default({}),
  }),
});

// --- Email ---
export const patchEmailSchema = z.object({
  params: z.object({ section: z.literal("email") }),
  body: z.object({
    sender_name: z.string().trim().min(1).max(100),
    sender_email: z.string().trim().email().max(320),
    provider: z.enum(["resend", "smtp", "ses"]).default("resend"),
    provider_config: z.record(z.string(), z.unknown()).default({}),
    smtp_password: z.string().max(2000).optional().or(z.literal("__REDACTED__")).or(z.literal("[redacted]")),
    notifications: z.object({
      order_placed: z.boolean().default(true),
      order_confirmed: z.boolean().default(true),
      order_shipped: z.boolean().default(true),
      order_delivered: z.boolean().default(true),
      order_cancelled: z.boolean().default(true),
      refund_issued: z.boolean().default(true),
      password_reset: z.boolean().default(true),
      new_registration: z.boolean().default(true),
      low_inventory: z.boolean().default(true),
      new_review: z.boolean().default(true),
      admin_security_alert: z.boolean().default(true),
    }),
  }),
});

// --- Customer ---
export const patchCustomerSchema = z.object({
  params: z.object({ section: z.literal("customer") }),
  body: z.object({
    allow_registration: z.boolean().default(true),
    require_email_verification: z.boolean().default(false),
    require_phone_verification: z.boolean().default(false),
    password_min_length: z.coerce.number().int().min(8).max(128).default(8),
    password_requirements: z
      .object({ upper: z.boolean().default(true), lower: z.boolean().default(true), digit: z.boolean().default(true), special: z.boolean().default(true) })
      .default({ upper: true, lower: true, digit: true, special: true }),
    session_duration_ms: z.coerce.number().int().min(60000).max(2592000000).default(2592000000),
    max_active_sessions: z.coerce.number().int().min(1).max(10).default(5),
    allow_account_deletion: z.boolean().default(true),
    allow_reviews: z.boolean().default(true),
    review_moderation: z.enum(["auto", "manual"]).default("auto"),
    purchase_gated_reviews: z.boolean().default(false),
  }),
});

// --- Security ---
export const patchSecuritySchema = z.object({
  params: z.object({ section: z.literal("security") }),
  body: z.object({
    session_timeout_ms: z.coerce.number().int().min(60000).max(2592000000).default(1209600000),
    admin_session_duration_ms: z.coerce.number().int().min(60000).max(2592000000).default(43200000),
    max_login_attempts: z.coerce.number().int().min(3).max(20).default(5),
    lockout_duration_ms: z.coerce.number().int().min(60000).max(3600000).default(900000),
    rate_limit: z.object({ window_ms: z.coerce.number().int().min(1000).max(3600000).default(60000), max: z.coerce.number().int().min(10).max(1000).default(100) }),
    password_policy: z
      .object({ min_length: z.coerce.number().int().min(8).max(128).default(8), require_upper: z.boolean().default(true), require_lower: z.boolean().default(true), require_digit: z.boolean().default(true), require_special: z.boolean().default(true) })
      .default({ min_length: 8, require_upper: true, require_lower: true, require_digit: true, require_special: true }),
    require_email_verification: z.boolean().default(false),
    require_2fa_admins: z.boolean().default(false),
    login_notifications: z.boolean().default(false),
    suspicious_login_alerts: z.boolean().default(true),
  }),
});

// --- Admin & Permissions ---
export const patchAdminPermissionsSchema = z.object({
  params: z.object({ section: z.literal("admin_permissions") }),
  body: z.object({
    invite_enabled: z.boolean().default(true),
    require_2fa: z.boolean().default(false),
    force_password_reset: z.boolean().default(false),
    max_admins: z.coerce.number().int().min(1).max(100).default(50),
    last_login_tracking: z.boolean().default(true),
    active_sessions_tracking: z.boolean().default(true),
    permissions_matrix: z.record(z.string(), z.unknown()).optional(),
  }),
});

// --- Financial ---
export const patchFinancialSchema = z.object({
  params: z.object({ section: z.literal("financial") }),
  body: z.object({
    default_currency: z.enum(["USD", "EUR", "GBP", "EGP", "SAR", "AED"]).default("USD"),
    tax_config: z.object({ mode: z.enum(["inclusive", "exclusive"]).default("exclusive"), rate: percentField.default("0.00") }),
    payment_fee: z.object({ fixed: moneyField.default("0.00"), percent: percentField.default("0.00") }),
    refund_accounting: z.enum(["credit", "reverse"]).default("credit"),
    coupon_cost_attribution: z.enum(["discount", "marketing"]).default("discount"),
    default_reporting_period: z.enum(["month", "quarter", "year", "custom"]).default("month"),
    fiscal_year_start: z.coerce.number().int().min(1).max(12).default(1),
    report_preferences: z.object({ granularity: z.enum(["auto", "day", "month"]).default("auto"), currency: z.enum(["USD", "EUR", "GBP", "EGP", "SAR", "AED"]).default("USD") }),
    expense_categories: z.array(z.string().trim().min(1).max(50)).default(["RENT", "SALARIES", "MARKETING", "UTILITIES", "SHIPPING", "SOFTWARE", "OTHER"]),
  }),
});

// --- Test email ---
export const testEmailSchema = z.object({
  body: z.object({
    to: z.string().trim().email().max(320),
  }),
});

// Generic patch fallback (for runtime section dispatch)
export const settingsSectionParam = z.object({ section: z.enum(SETTINGS_KEYS) });

export type SettingsKey = z.infer<typeof settingsKeySchema>;

// Helper to get schema by section
export function getPatchSchema(section: string) {
  switch (section) {
    case "general":
      return patchGeneralSchema;
    case "commerce":
      return patchCommerceSchema;
    case "payment":
      return patchPaymentSchema;
    case "shipping":
      return patchShippingSchema;
    case "email":
      return patchEmailSchema;
    case "customer":
      return patchCustomerSchema;
    case "security":
      return patchSecuritySchema;
    case "admin_permissions":
      return patchAdminPermissionsSchema;
    case "financial":
      return patchFinancialSchema;
    default:
      return null;
  }
}
