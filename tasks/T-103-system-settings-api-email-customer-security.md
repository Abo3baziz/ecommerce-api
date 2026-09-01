# T-103 — System settings API: Email & Notifications, Customer, Security

| Field | Value |
|-------|-------|
| **ID** | T-103 |
| **Priority** | P1 |
| **Status** | done |
| **Type** | `feature` |
| **Branch** | `feature/system-settings` |
| **Depends on** | T-100 |
| **Blocks** | T-105 |

## Problem

Requirements §6+§7+§8 demand persisted notification matrix, customer behavior, and security posture (§11 SUPER_ADMIN, validation, audit).

## Goal

`GET/PATCH /admin/settings/email`, `/customer`, `/security` with proper Zod, masked email secrets, security overview computed field.

## Scope

- `email`: `sender_name 1-100`, `sender_email email`, `provider enum resend|smtp|ses`, `provider_config Json masked (smtp_password)`, `test_email email`, `notifications Json {order_placed,order_confirmed,order_shipped,order_delivered,order_cancelled,refund_issued,password_reset,new_registration,low_inventory,new_review,admin_security_alert: boolean}`.
- `customer`: `allow_registration boolean`, `require_email_verification boolean`, `require_phone_verification boolean`, `password_min_length 8-128`, `password_requirements {upper,lower,digit,special}`, `session_duration_ms coerce`, `max_active_sessions 1-10`, `allow_account_deletion boolean`, `allow_reviews boolean`, `review_moderation enum auto|manual`, `purchase_gated_reviews boolean`.
- `security`: `session_timeout_ms`, `admin_session_duration_ms`, `max_login_attempts 3-20`, `lockout_duration_ms`, `rate_limit {window_ms,max}`, `password_policy {min_length,require_*}`, `require_email_verification boolean`, `require_2fa_admins boolean`, `login_notifications boolean`, `suspicious_login_alerts boolean`, `security_status computed enum hardened|partial|weak` (count enabled flags).
- Encrypted `smtp_password` same as T-102.

## Acceptance criteria

- [ ] Each `GET` returns section JSON; each `PATCH` validates and persists.
- [ ] Email secrets masked; security overview reflects enabled protections.
- [ ] 403 for ADMIN, 200 SUPER_ADMIN.
- [ ] `npm run typecheck` green.

## References

- `src/modules/auth/validators/*:1`, `src/shared/validation/index.ts:1`, `src/modules/analytics/validators/admin.ts:1`
