# T-101 — System settings API: General & Commerce (SUPER_ADMIN)

| Field | Value |
|-------|-------|
| **ID** | T-101 |
| **Priority** | P1 |
| **Status** | done |
| **Type** | `feature` |
| **Branch** | `feature/system-settings` |
| **Depends on** | T-100 |
| **Blocks** | T-105 |

## Problem

Backend has no `GET/PATCH /admin/settings/:section` endpoints. Requirement §2+§3 demand SUPER_ADMIN-only persisted global store config and commerce behavior.

## Goal

Implement `GET /admin/settings?section=general|commerce` and `PATCH /admin/settings/general|commerce` with Zod validation, repository, service (Decimal→string, fallback), controller, routes `authorization(SUPER_ADMIN)`.

## Scope

- Module `src/modules/settings/` — `routes/admin.routes.ts` mounts at `src/routes/v1/index.ts:53` (`/admin/settings`) after `auditAdminMutations`.
- Validators `validators/admin.ts`:
  - `general`: `store_name 1-100`, `store_description max 5000`, `contact_email email`, `support_phone E.164`, `store_address 1-500`, `default_language enum`, `default_currency REPORT_CURRENCIES`, `timezone IANA`, `date_format enum`, `maintenance_mode boolean`, `store_active boolean`, `logo_url url optional (plan only)`.
  - `commerce`: `tax_rate moneyField 0-100`, `tax_mode enum inclusive|exclusive`, `vat_enabled boolean`, `min_order_amount moneyField`, `max_order_amount moneyField`, `free_shipping_threshold moneyField`, `allow_guest_checkout boolean`, `allow_customer_registration boolean`, `allow_multiple_addresses boolean`, `order_cancellation_window_hours 0-168`, `return_window_days 0-90`, `refund_window_days 0-90`, `low_stock_threshold int 1-10000` with `superRefine(min ≤ free ≤ max)`.
- Repository `repository/settings.repository.ts` — `findByKey`, `findMany`, `upsert` via `prisma.system_settings`.
- Service `service/settings.service.ts` — read fallback to `src/shared/constants`, write `prisma.$transaction` upsert, `Decimal` handling.
- Controller `controller/admin.controller.ts` — thin, `validate()` provides `req.params`/`req.body`.
- **Auth:** `authentication` + `authorization(user_role.SUPER_ADMIN)` per `src/middleware/authorization.ts:10`.

## Acceptance criteria

- [ ] `GET /admin/settings?section=general` returns `{success:true,data:{key,value,updated_at}}` 200 for SUPER_ADMIN, 403 for ADMIN/CUSTOMER.
- [ ] `PATCH /admin/settings/general` validates Zod; 400 on bad email/phone/timezone; money stays string.
- [ ] `PATCH /admin/settings/commerce` rejects `min > max`; `free_threshold` cross-check.
- [ ] `npm run typecheck` green.

## References

- `src/modules/categories/validators/category.ts:1`, `src/modules/reports/validators/admin.ts:1`, `src/middleware/validate.ts:1`, `src/middleware/authorization.ts:1`, `src/generated/prisma/enums.ts:5`, `src/shared/validation/index.ts:1`
