# Admin Management API

## Overview

Super-admin-only surface for managing admin accounts and their activity.
Distinct from the customer-scoped `/admin/users` endpoints (which return 404
for admin targets by design).

All endpoints require a `SUPER_ADMIN` session; regular admins receive `403`.
Mutations are auto-audited (`admin.admins.suspend`, `.activate`).

## Activity status

Derived server-side from three signals — last login, last session activity,
and the latest audit action. An admin is ACTIVE when any signal falls within
the last 2 days; otherwise INACTIVE. Accounts with `status = SUSPENDED`
always render SUSPENDED.

---

# List Admins

```
GET /api/v1/admin/admins
```

| Parameter | Description |
| --- | --- |
| `page`, `limit` | Pagination |
| `search` | Name or email, case-insensitive |
| `status` | ACTIVE or SUSPENDED (account status) |
| `activity` | ACTIVE or INACTIVE (2-day rule) |
| `sort` | `-last_login_at` default; also `name`, `created_at` |

Response rows:

```
{
  "public_id": "usr_…",
  "first_name": "…", "last_name": "…", "email": "…", "phone_number": "…",
  "role": "ADMIN" | "SUPER_ADMIN",
  "status": "ACTIVE",
  "activity_status": "ACTIVE",
  "created_at": "…",
  "last_login_at": null | "…",
  "last_activity_at": null | "…",
  "last_action_at": null | "…",
  "last_action_type": null | "admin.orders.status_transition"
}
```

# Get / Suspend / Activate

```
GET   /api/v1/admin/admins/{public_id}
PATCH /api/v1/admin/admins/{public_id}/suspend
PATCH /api/v1/admin/admins/{public_id}/activate
```

Suspend sets status SUSPENDED and revokes every live session in one
transaction. Guards: an admin cannot target themselves and the SUPER_ADMIN
account can never be suspended (`409`/`403`). Role changes keep using the
existing `PATCH /admin/users/{id}/role` endpoint (super-admin only, last-admin
guard applies).
