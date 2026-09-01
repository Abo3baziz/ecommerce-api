# T-102 — System settings API: Payment & Shipping (encrypted secrets)

| Field | Value |
|-------|-------|
| **ID** | T-102 |
| **Priority** | P1 |
| **Status** | done |
| **Type** | `feature` |
| **Branch** | `feature/system-settings` |
| **Depends on** | T-100 |
| **Blocks** | T-105 |

## Problem

Payment and shipping configuration requires encrypted secrets, masked reads, and SUPER_ADMIN-only access (§4+§5). No endpoints exist.

## Goal

`GET/PATCH /admin/settings/payment` and `/shipping` with at-rest encryption, masked `GET`, sentinel `__REDACTED__` on PATCH, SUPER_ADMIN.

## Scope

- Validators:
  - `payment`: `enabled_methods enum[]`, `cod_enabled boolean`, `card_enabled boolean`, `provider enum stripe|paymob|manual`, `provider_config Json (masked)`, `provider_secret_key masked`, `webhook_secret masked`, `test_mode boolean`, `currency_restrictions subset REPORT_CURRENCIES`, `payment_failure_behavior enum retry|hold|fail`, `min_transaction moneyField`, `max_transaction moneyField`.
  - `shipping`: `enabled_methods string[]`, `zones Json[]`, `rates Json[] {zone, weight_max, price moneyField}`, `free_shipping_rules Json`, `estimated_delivery {min_days,max_days}`, `default_method string`, `provider_config Json masked`.
- Service: `encryptIfNeeded(value)` `aes-256-gcm` via `SETTINGS_ENCRYPTION_KEY` (`src/config/env.ts`); store `{cipher, iv, tag, version}` inside JsonB; `decrypt` on internal use only, never return raw. `GET` maps secrets to `"[redacted]"`. `PATCH` with `"__REDACTED__"` preserves existing cipher.
- Do not expose plain text; violations logged without secret.

## Acceptance criteria

- [ ] `GET /admin/settings?section=payment` returns masked secrets; raw never in response.
- [ ] `PATCH /payment` with `__REDACTED__` preserves cipher; new secret re-encrypts.
- [ ] 403 for ADMIN, 200 for SUPER_ADMIN.
- [ ] Audit does not log raw secret (see T-105).
- [ ] `npm run typecheck` green.

## References

- `src/modules/settings/utils/encryption.ts` (new), `src/config/env.ts:1`, `src/middleware/auditLog.ts:22`, `src/shared/validation/index.ts:1`
