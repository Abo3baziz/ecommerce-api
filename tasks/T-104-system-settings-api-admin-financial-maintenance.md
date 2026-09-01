# T-104 — System settings API: Admin & Permissions, Financial, Maintenance

| Field | Value |
|-------|-------|
| **ID** | T-104 |
| **Priority** | P1 |
| **Status** | done |
| **Type** | `feature` |
| **Branch** | `feature/system-settings` |
| **Depends on** | T-100 |
| **Blocks** | T-105, T-106 |

## Problem

Remaining §9+§10+§2/11: Admin & Permissions management, Financial configuration for existing P&L/revenue/coupons, and store active/maintenance page (§2: when inactive display maintenance).

## Goal

`GET/PATCH /admin/settings/admin_permissions`, `/financial`, plus maintenance wiring so storefront returns 503 when `general.maintenance_mode || !store_active` (SUPER_ADMIN still accesses `/admin`).

## Scope

- `admin_permissions`: `invite_enabled boolean`, `require_2fa boolean`, `force_password_reset boolean`, `max_admins int`, `last_login_tracking boolean`, `active_sessions_tracking boolean`, enriches `src/modules/admins/service/*` to expose `last_login`, `active_sessions`, `revoke/force reset` already via `admins` module — reuse.
- `financial`: `default_currency REPORT_CURRENCIES`, `tax_config {mode,rate moneyField}`, `payment_fee {fixed moneyField, percent 0-100}`, `refund_accounting enum credit|reverse`, `coupon_cost_attribution enum marketing|discount`, `default_reporting_period REPORT_PERIODS`, `fiscal_year_start 1-12`, `report_preferences {granularity, currency}`, `expense_categories string[]` (superset of `expense_category` enum).
- `general` maintenance: service `getGeneralSettings()` consumed by new `src/middleware/maintenance.ts` checking `system_settings` cache (in-memory with `updated_at` invalidation); bypass for `/admin/*` + `/health`. Return `503 {success:false,message:"Store under maintenance"}` or static `public/maintenance.html` for non-API.
- Respect `user_role.ADMIN` vs `SUPER_ADMIN` existing model; financial reporting thresholds remain SUPER_ADMIN.

## Acceptance criteria

- [ ] `GET/PATCH /admin_permissions` and `/financial` SUPER_ADMIN only.
- [ ] Financial expense categories persist custom entries beyond enum.
- [ ] Maintenance on returns 503 for storefront `/` and `/api/products` etc., but `/admin` and `/admin/settings` remain 200 for SUPER_ADMIN.
- [ ] `npm run typecheck` green.

## References

- `src/modules/admins/*:1`, `src/modules/reports/dto/reports.ts:1`, `src/modules/analytics/*:1`, `src/app/index.ts:1`, `public/maintenance.html` (new), `src/generated/prisma/enums.ts:1`
