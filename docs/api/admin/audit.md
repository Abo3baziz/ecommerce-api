# Admin Audit Log

## Overview

Append-only trail of privileged actions. Two writers:

1. **Automatic** (`src/middleware/auditLog.ts`): every authenticated mutating
   request (`POST`/`PATCH`/`PUT`/`DELETE`) under `/api/v1/admin/*` produces one
   row — actor, semantic `action`, target entity, redacted body snapshot,
   IP/user-agent, response status. Future admin endpoints are covered with no
   extra code.
2. **Explicit**: security-relevant auth events of admin accounts —
   `auth.admin.login`, `auth.admin.login_failed` (unknown emails recorded with
   no actor), `auth.admin.logout`, `auth.admin.session_revoked`,
   `auth.admin.sessions_revoked`. Customer auth activity is never recorded.

Rows are immutable: the application exposes no update or delete path, and
retention is forever.

## Semantic action names

| Pattern | Action |
| --- | --- |
| `PATCH /admin/users/{id}/role` | `admin.users.role_change` |
| `PATCH /admin/users/{id}/suspend` | `admin.users.suspend` |
| `PATCH /admin/users/{id}/activate` | `admin.users.activate` |
| `PATCH /admin/inventory/{variant}/reserve` | `admin.inventory.reserve_change` |
| `PATCH /admin/orders/{id}` | `admin.orders.status_transition` |
| `PUT/DELETE /admin/categories/{c}/products/{p}` | `admin.categories.assign_product` / `.remove_product` |
| any other mutation | `admin.<segment>.<create\|update\|delete>` |

**Exception — coupons:** `/api/v1/admin/coupons/*` mutations are excluded
from the generic middleware and emit their own richer transactional rows
(`admin.coupons.create`, `.update`, `.status_change`, `.delete`) carrying
per-field diffs and the previous row image. Checkout redemptions and
cancel/refund restorations additionally write customer-side
`coupon.redeemed` / `coupon.released` events.

Entity fields resolve from the deepest id-bearing segment
(`product`, `category`, `inventory`, `order`, `review`, `customer`,
`session`). Request bodies are deep-redacted: any key matching
`/password|secret|token|otp/i` becomes `[redacted]`.

---

## List Audit Entries

```
GET /api/v1/admin/audit
```

Requires an authenticated **SUPER_ADMIN** session (regular admins receive
`403`).

### Query parameters

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `page` | int ≥ 1 | `1` | Page number |
| `limit` | int 1–100 | `20` | Entries per page |
| `actor` | string | – | Filter by actor `public_id` |
| `action` | string | – | Prefix match, e.g. `admin.users.` |
| `entity_type` | string | – | e.g. `product`, `order` |
| `entity_public_id` | string | – | Target entity id |
| `date_from` / `date_to` | ISO datetime | – | Inclusive bounds on `created_at` |
| `sort` | `-created_at` | `-created_at` | Newest first |

### Response

```
{
  "success": true,
  "data": [
    {
      "public_id": "aud_…",
      "action": "admin.inventory.reserve_change",
      "entity_type": "inventory",
      "entity_public_id": "var_…",
      "method": "PATCH",
      "path": "/api/v1/admin/inventory/var_…/reserve",
      "status_code": 200,
      "request_body": { "change": -3 },
      "ip_address": "…",
      "user_agent": "…",
      "created_at": "2026-…",
      "actor": { "public_id": "usr_…", "name": "…", "email": "…" }
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 42, … }
}
```

### Errors

| Status | Condition |
| --- | --- |
| 400 | Invalid query parameters |
| 401 | Missing/invalid session |
| 403 | Authenticated user is not `SUPER_ADMIN` |

---

## Notes

- Auditing is fire-and-forget: a failed insert is logged via pino and never
  fails the business request.
- Reads (GETs) are not audited this round; before/after diffs and export are
  documented future enhancements.
