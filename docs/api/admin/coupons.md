# Coupons API

## Overview

Admin management of discount coupons. All endpoints require an authenticated
session with the ADMIN or SUPER_ADMIN role; customers receive 403.

Every mutation writes exactly one transactional audit row
(admin.coupons.create / .update / .status_change / .delete) including
per-field `changes` ({from,to}) and the `previous_values` pre-image. If the
audit insert fails, the business action rolls back. The generic /admin/*
capture middleware deliberately skips this prefix to avoid duplicates (see
docs/api/admin/audit.md).

## Coupon object

```json
{
  "public_id": "cpn_...",
  "code": "SUMMER10",
  "discount_type": "PERCENTAGE",
  "discount_value": "10",
  "minimum_order_amount": "200",
  "maximum_discount_amount": null,
  "usage_limit": 100,
  "usage_limit_per_user": 1,
  "usage_count": 7,
  "starts_at": "2026-08-01T00:00:00.000Z",
  "expires_at": "2026-08-31T23:59:59.999Z",
  "is_active": true,
  "deleted_at": null,
  "created_at": "...",
  "updated_at": "...",
  "status": "ACTIVE"
}
```

Derived status (checked in order): INACTIVE when is_active=false or starts_at
in the future; EXPIRED past expires_at; USAGE_LIMIT_REACHED at limit;
otherwise ACTIVE.

Validation rules: code is 3-50 chars from [A-Za-z0-9_-], uppercased, globally
unique; percentage values are capped at 100; maximum_discount_amount acts as
the cap for percentage coupons; expires_at must be after starts_at; both
usage limits are required integers >= 1. The code cannot be changed once
usage_count > 0 (409).

## Endpoints

### List Coupons

GET /api/v1/admin/coupons

Query parameters:

- page, limit (default 20)
- search - code prefix match, case-insensitive
- status - ACTIVE | INACTIVE | EXPIRED | USAGE_LIMIT_REACHED (implies non-deleted rows)
- include_deleted - true/false, default false
- sort - optional leading "-" for descending over code | discount_value |
  usage_count | starts_at | expires_at | created_at

Response: { success, data: [Coupon], pagination }.

### Create Coupon

POST /api/v1/admin/coupons

Body: Coupon fields minus read-only ones (public_id, usage_count,
timestamps, status). Responses: 201 created; 400 validation; 409 duplicate
code. Audit: admin.coupons.create.

### Get / Update / Delete Coupon

GET    /api/v1/admin/coupons/{public_id}
PATCH  /api/v1/admin/coupons/{public_id}
DELETE /api/v1/admin/coupons/{public_id}

Update accepts any subset of editable fields; the audit action is
.status_change when only is_active changes, otherwise .update. Delete
soft-deletes (sets deleted_at, deactivates); audit action .delete carries the
pre-image in previous_values.

### Redemption history

GET /api/v1/admin/coupons/{public_id}/usages?page=&limit=

Returns { success, data: [ { public_id, order_public_id, order_number,
customer_public_id, customer_name, customer_email, discount_amount,
redeemed_at } ], pagination } ordered newest first.
