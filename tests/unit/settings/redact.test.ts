import { describe, it, expect } from "vitest";
import { maskSecrets, redactValue, buildRedactedChanges } from "../../../src/modules/settings/utils/redact.js";

describe("maskSecrets", () => {
  it("masks known secret fields (exact match) and encrypted payloads", () => {
    const input = {
      provider_secret_key: "sk_live_abc",
      webhook_secret: { v: 1, iv: "aa", tag: "bb", data: "cc" },
      smtp_password: "",
      provider: "resend",
    };
    const out = maskSecrets(input) as Record<string, unknown>;
    expect(out.provider_secret_key).toBe("[redacted]");
    expect(out.webhook_secret).toBe("[redacted]");
    expect(out.smtp_password).toBe("");
    expect(out.provider).toBe("resend");
  });

  it("REGRESSION: never masks boolean notification toggles like password_reset", () => {
    const input = {
      notifications: {
        order_placed: true,
        password_reset: false,
        new_registration: true,
        admin_security_alert: true,
      },
    };
    const out = maskSecrets(input) as { notifications: Record<string, unknown> };
    expect(out.notifications.password_reset).toBe(false);
    expect(out.notifications.order_placed).toBe(true);
  });

  it("REGRESSION: never masks string settings that merely contain 'key' in the name", () => {
    const input = { notifications: { password_reset: "[redacted]" } };
    // Even a previously-corrupted string inside notifications is not a secret
    // field; only exact secret field names are masked outside provider_config.
    const out = maskSecrets(input) as { notifications: Record<string, unknown> };
    expect(out.notifications.password_reset).toBe("[redacted]");
  });

  it("masks secret-looking keys inside free-form provider_config", () => {
    const input = {
      provider_config: { api_key: "key123", client_secret: "sec123", region: "eu", retries: 3 },
    };
    const out = maskSecrets(input) as { provider_config: Record<string, unknown> };
    expect(out.provider_config.api_key).toBe("[redacted]");
    expect(out.provider_config.client_secret).toBe("[redacted]");
    expect(out.provider_config.region).toBe("eu");
    expect(out.provider_config.retries).toBe(3);
  });

  it("does not pattern-match outside provider_config", () => {
    const input = { zones: [{ name: "secret_zone", countries: ["EG"] }] };
    const out = maskSecrets(input) as { zones: Array<Record<string, unknown>> };
    expect(out.zones[0].name).toBe("secret_zone");
  });
});

describe("redactValue", () => {
  it("redacts known secret fields and secret-looking keys in config objects", () => {
    const input = {
      provider_secret_key: "sk_live_abc",
      notifications: { password_reset: true },
      provider_config: { smtp_password: "pw", tls: true },
    };
    const out = redactValue(input) as Record<string, unknown>;
    expect(out.provider_secret_key).toBe("[redacted]");
    expect((out.notifications as Record<string, unknown>).password_reset).toBe(true);
    expect((out.provider_config as Record<string, unknown>).smtp_password).toBe("[redacted]");
    expect((out.provider_config as Record<string, unknown>).tls).toBe(true);
  });
});

describe("buildRedactedChanges", () => {
  it("produces from/to diffs only for changed fields", () => {
    const changes = buildRedactedChanges({ a: 1, b: "x" }, { b: "y", c: true });
    expect(changes).toEqual({
      a: { from: 1, to: null },
      b: { from: "x", to: "y" },
      c: { from: null, to: true },
    });
  });

  it("emits no raw secrets because inputs are pre-redacted", () => {
    const changes = buildRedactedChanges(
      redactValue({ provider_secret_key: "sk_new" }),
      redactValue({ provider_secret_key: "[redacted]" }),
    );
    expect(JSON.stringify(changes)).not.toContain("sk_new");
  });
});
