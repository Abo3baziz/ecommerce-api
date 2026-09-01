# Admin System Settings

## Overview

Persisted, SUPER_ADMIN-managed global store configuration. Settings are stored
one row per section in the `system_settings` table (`key` unique, `value` JSONB)
and validated per-section with Zod on every write.

- **Auth:** session cookie + `x-csrf-token` on writes; every endpoint here
  requires the **SUPER_ADMIN** role (regular `ADMIN` receives `403`).
- **Read fallback:** no crashes when a section row is missing — the service
  treats a missing row as `404` on the section read; migrations seed defaults
  for all 9 sections.
- **Public IDs only:** the actor is exposed as `updated_by` (the acting user's
  `usr_…` public_id), never the internal integer ID.
- **Secret masking:** secret-typed fields (`provider_secret_key`,
  `webhook_secret`, `smtp_password`, and secret-looking keys inside
  `provider_config`) are encrypted at rest with AES-256-GCM
  (`SETTINGS_ENCRYPTION_KEY`, required in production) and are never returned in
  plain text — reads map them to `"[redacted]"`.
- **Write semantics:** each `PATCH /admin/settings/:section` validates the
  *full section object* (defaults are applied for omitted optional fields).
  Send `"__REDACTED__"` (or `"[redacted]"`) for a secret field to preserve the
  previously stored cipher; any other non-empty string re-encrypts.
- **Audit:** `/admin/settings/*` mutations are excluded from the generic audit
  middleware and emit their own transactional, redacted audit rows inside the
  same DB transaction as the update (see [Audit](#audit-trail)).

## Sections (9)

`general`, `commerce`, `payment`, `shipping`, `email`, `customer`,
`security`, `admin_permissions`, `financial`

| Section | Notable fields (validated) |
| --- | --- |
| `general` | `store_name` 1–100 (required), `contact_email` email (required), `support_phone` ≤20, `store_address` ≤500, `default_language` enum, `default_currency` enum, `timezone` string, `date_format` enum, `maintenance_mode` bool, `store_active` bool, `logo_url` url |
| `commerce` | `vat_enabled`, `default_tax_rate` money 0–100, `tax_mode` enum `inclusive\|exclusive`, `min_order_amount`/`max_order_amount`/`free_shipping_threshold` money strings, guest/registration/multi-address bools, `order_cancellation_window_hours` 0–168, `return_window_days`/`refund_window_days` 0–90, `low_stock_threshold` 1–10000; cross-check `min ≤ max` |
| `payment` | `enabled_methods` enum[] (`cod`, `card`), `cod_enabled`/`card_enabled`, `provider` enum `manual\|stripe\|paymob`, `provider_config` JSON, `provider_secret_key`/`webhook_secret` (encrypted), `test_mode`, `currency_restrictions` enum[], `payment_failure_behavior` enum, `min_transaction`/`max_transaction` money; cross-check `min ≤ max` |
| `shipping` | `enabled_methods` string[], `zones[]` (`name`, `countries[]`, `regions[]`), `rates[]` (`zone`, `weight_max`, `price` money), `free_shipping_rules` JSON, `estimated_delivery {min_days,max_days}` 0–60, `default_method`, `provider_config` JSON |
| `email` | `sender_name` 1–100 (required), `sender_email` email (required), `provider` enum `resend\|smtp\|ses`, `provider_config` JSON (`smtp_password` encrypted), `notifications` object with 11 boolean toggles (required) |
| `customer` | `allow_registration`, `require_email_verification`, `require_phone_verification`, `password_min_length` 8–128, `password_requirements {upper,lower,digit,special}`, `session_duration_ms`, `max_active_sessions` 1–10, `allow_account_deletion`, `allow_reviews`, `review_moderation` enum `auto\|manual`, `purchase_gated_reviews` |
| `security` | `session_timeout_ms`, `admin_session_duration_ms`, `max_login_attempts` 3–20, `lockout_duration_ms`, `rate_limit {window_ms,max}`, `password_policy {min_length,require_*}`, `require_email_verification`, `require_2fa_admins`, `login_notifications`, `suspicious_login_alerts` |
| `admin_permissions` | `invite_enabled`, `require_2fa`, `force_password_reset`, `max_admins` 1–100, `last_login_tracking`, `active_sessions_tracking`, `permissions_matrix` JSON |
| `financial` | `default_currency` enum, `tax_config {mode,rate}`, `payment_fee {fixed,percent}`, `refund_accounting` enum `credit\|reverse`, `coupon_cost_attribution` enum `discount\|marketing`, `default_reporting_period` enum, `fiscal_year_start` 1–12, `report_preferences {granularity,currency}`, `expense_categories` string[] (superset of the report expense enum) |

Money values are decimal **strings** (`"10.00"`, pattern `^\d{1,10}(\.\d{1,2})?$`).

---

## List Settings

```
GET /api/v1/admin/settings
```

Returns all sections. Requires **SUPER_ADMIN**.

### Query parameters

| Parameter | Type | Description |
| --- | --- | --- |
| `section` | enum (optional) | Restrict to one section (`general`, `commerce`, …) |

### Responses

| Status | Meaning |
| --- | --- |
| `200` | Array (or single object when `section` is given) of `{ key, value, updated_at, updated_by }`; secrets masked as `"[redacted]"` |
| `400` | Unknown `section` value |
| `401` | No session |
| `403` | Authenticated but not SUPER_ADMIN |
| `404` | `section` given but the row does not exist |

---

## Update Section

```
PATCH /api/v1/admin/settings/{section}
```

`{section}` is one of the 9 section keys. Requires **SUPER_ADMIN**.

### Body

The full section object (see the table above). Omitted optional fields take
their defaults; required identity fields (`store_name`/`contact_email` for
`general`, `sender_name`/`sender_email`/`notifications` for `email`) must be
resent. Secret fields sent as `"__REDACTED__"`/`"[redacted]"` preserve the
stored cipher; other non-empty values are re-encrypted before persisting.

### Responses

| Status | Meaning |
| --- | --- |
| `200` | Updated section (same shape as read; secrets masked) + one transactional audit row |
| `400` | Validation failure (bad enum/email/phone, money format, cross-field `min > max`) |
| `401` / `403` | No session / not SUPER_ADMIN |

---

## Send Test Email

```
POST /api/v1/admin/settings/email/test
```

Requires **SUPER_ADMIN**. Body `{ "to": "email" }` — acknowledges the target
address using the configured email provider. `400` on a missing/invalid `to`.

---

## Audit trail

Every `PATCH` writes one `audit_logs` row **in the same transaction** as the
settings update:

| Field | Value |
| --- | --- |
| `action` | `admin.settings.{section}_update` |
| `entity_type` | `system_settings` |
| `entity_public_id` | the section key |
| `request_body` / `previous_values` / `changes` | deep-redacted (secret keys → `"[redacted]"`) |

`/admin/settings/*` is excluded from the generic audit middleware, so no
duplicate rows appear. Query them via `GET /admin/audit?entity_type=system_settings`
(and optionally `entity_public_id=general`).

---

## Maintenance behavior

When `general.maintenance_mode` is `true` or `general.store_active` is `false`,
non-exempt requests receive `503 { success:false, message: "Store under
maintenance" }`. Exempt prefixes: `/health`, `/api/v1/admin` (so SUPER_ADMIN
keeps console access), and `/api/v1/auth` (so an admin without a live session
can still log in). The flag is served from a 30-second in-memory cache.
