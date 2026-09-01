import { describe, it, expect } from "vitest";
import {
  getSettingsSchema,
  patchGeneralSchema,
  patchCommerceSchema,
  patchPaymentSchema,
  patchShippingSchema,
  patchEmailSchema,
  patchCustomerSchema,
  patchSecuritySchema,
  patchAdminPermissionsSchema,
  patchFinancialSchema,
  testEmailSchema,
  getPatchSchema,
  SETTINGS_KEYS,
} from "../../../src/modules/settings/validators/admin.js";

function parse(schema: { parse: (v: unknown) => unknown }, section: string, body: unknown) {
  return schema.parse({ params: { section }, body });
}

describe("settings section registry", () => {
  it("covers exactly the 9 documented sections", () => {
    expect(SETTINGS_KEYS).toEqual([
      "general",
      "commerce",
      "payment",
      "shipping",
      "email",
      "customer",
      "security",
      "admin_permissions",
      "financial",
    ]);
  });

  it("resolves a patch schema for every section and none for unknown keys", () => {
    for (const key of SETTINGS_KEYS) {
      expect(getPatchSchema(key)).not.toBeNull();
    }
    expect(getPatchSchema("unknown")).toBeNull();
  });
});

describe("testEmailSchema", () => {
  it("requires a valid recipient email", () => {
    expect(testEmailSchema.parse({ body: { to: "admin@example.com" } }).body.to).toBe("admin@example.com");
    expect(() => testEmailSchema.parse({ body: {} })).toThrow();
    expect(() => testEmailSchema.parse({ body: { to: "nope" } })).toThrow();
  });
});

describe("getSettingsSchema", () => {
  it("accepts a valid section and rejects unknown ones", () => {
    expect(getSettingsSchema.parse({ query: { section: "general" } }).query.section).toBe("general");
    expect(getSettingsSchema.parse({ query: {} }).query.section).toBeUndefined();
    expect(() => getSettingsSchema.parse({ query: { section: "hacker" } })).toThrow();
  });
});

describe("patchGeneralSchema", () => {
  it("requires identity fields and applies documented defaults", () => {
    expect(() => parse(patchGeneralSchema, "general", {})).toThrow();
    const data = parse(patchGeneralSchema, "general", {
      store_name: "My Store",
      contact_email: "support@example.com",
    }) as { body: Record<string, unknown> };
    expect(data.body.store_name).toBe("My Store");
    expect(data.body.default_language).toBe("en");
    expect(data.body.default_currency).toBe("USD");
    expect(data.body.timezone).toBe("UTC");
    expect(data.body.maintenance_mode).toBe(false);
    expect(data.body.store_active).toBe(true);
  });

  it("rejects malformed contact_email", () => {
    expect(() => parse(patchGeneralSchema, "general", { contact_email: "not-an-email" })).toThrow();
  });

  it("rejects over-long support_phone", () => {
    expect(() => parse(patchGeneralSchema, "general", { support_phone: "1".repeat(21) })).toThrow();
  });
});

describe("patchCommerceSchema", () => {
  it("keeps money fields as strings with defaults", () => {
    const data = parse(patchCommerceSchema, "commerce", {}) as {
      body: Record<string, unknown>;
    };
    expect(data.body.min_order_amount).toBe("0.00");
    expect(data.body.max_order_amount).toBe("999999.00");
    expect(data.body.free_shipping_threshold).toBe("500.00");
  });

  it("rejects min_order_amount greater than max_order_amount", () => {
    expect(() =>
      parse(patchCommerceSchema, "commerce", { min_order_amount: "100.00", max_order_amount: "50.00" }),
    ).toThrow();
  });

  it("rejects money values with too many decimals", () => {
    expect(() => parse(patchCommerceSchema, "commerce", { min_order_amount: "1.234" })).toThrow();
  });

  it("rejects numeric (non-string) money values", () => {
    expect(() => parse(patchCommerceSchema, "commerce", { min_order_amount: 5 })).toThrow();
  });

  it("enforces the cancellation-window bounds", () => {
    expect(() => parse(patchCommerceSchema, "commerce", { order_cancellation_window_hours: 169 })).toThrow();
  });
});

describe("patchPaymentSchema", () => {
  it("accepts the redaction sentinel used to preserve stored ciphers", () => {
    const data = parse(patchPaymentSchema, "payment", { provider_secret_key: "__REDACTED__" }) as {
      body: Record<string, unknown>;
    };
    expect(data.body.provider_secret_key).toBe("__REDACTED__");
  });

  it("rejects min_transaction greater than max_transaction", () => {
    expect(() =>
      parse(patchPaymentSchema, "payment", { min_transaction: "200.00", max_transaction: "100.00" }),
    ).toThrow();
  });
});

describe("patchShippingSchema", () => {
  it("validates rate prices as money strings", () => {
    const data = parse(patchShippingSchema, "shipping", {
      rates: [{ zone: "local", price: "25.50" }],
    }) as { body: { rates: Array<Record<string, unknown>> } };
    expect(data.body.rates[0].price).toBe("25.50");
    expect(() =>
      parse(patchShippingSchema, "shipping", { rates: [{ zone: "local", price: "abc" }] }),
    ).toThrow();
  });
});

describe("patchEmailSchema", () => {
  it("rejects a malformed sender_email", () => {
    expect(() => parse(patchEmailSchema, "email", { sender_email: "nope" })).toThrow();
  });

  it("requires sender identity fields and validates the notification matrix", () => {
    expect(() => parse(patchEmailSchema, "email", {})).toThrow();
    const notifications = {
      order_placed: true,
      order_confirmed: true,
      order_shipped: true,
      order_delivered: true,
      order_cancelled: false,
      refund_issued: true,
      password_reset: true,
      new_registration: false,
      low_inventory: true,
      new_review: true,
      admin_security_alert: true,
    };
    const data = parse(patchEmailSchema, "email", {
      sender_name: "Store",
      sender_email: "no-reply@example.com",
      notifications,
    }) as { body: { notifications: Record<string, boolean> } };
    expect(data.body.notifications).toEqual(notifications);
  });
});

describe("patchCustomerSchema", () => {
  it("enforces password_min_length >= 8", () => {
    expect(() => parse(patchCustomerSchema, "customer", { password_min_length: 4 })).toThrow();
  });
});

describe("patchSecuritySchema", () => {
  it("enforces max_login_attempts bounds (3-20)", () => {
    expect(() => parse(patchSecuritySchema, "security", { max_login_attempts: 2 })).toThrow();
    expect(() => parse(patchSecuritySchema, "security", { max_login_attempts: 21 })).toThrow();
  });
});

describe("patchAdminPermissionsSchema", () => {
  it("applies defaults on an empty patch", () => {
    const data = parse(patchAdminPermissionsSchema, "admin_permissions", {}) as {
      body: Record<string, unknown>;
    };
    expect(data.body.max_admins).toBe(50);
    expect(data.body.invite_enabled).toBe(true);
  });
});

describe("patchFinancialSchema", () => {
  it("enforces fiscal_year_start month bounds (1-12)", () => {
    expect(() => parse(patchFinancialSchema, "financial", { fiscal_year_start: 13 })).toThrow();
  });
});
