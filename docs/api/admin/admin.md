# Admin API

## Overview

The Admin API provides privileged endpoints for managing the e-commerce platform.

All endpoints require:

- Authentication
- An active session
- The `admin` **or** `super_admin` role

Regular customers cannot access these endpoints. `super_admin` has full access to every admin module (users, products, categories) and is additionally the only role allowed to manage other users' roles.

---

# Authentication

All requests require:

- Valid authenticated session
- User role: `admin` or `super_admin`

If either requirement is not met:

```
403 Forbidden
```

---

# Responsibilities

The Admin API is responsible for:

- Customer management
- Product management
- Category management
- Inventory management
- Order management
- Review moderation
- Administrative reporting

Authentication is handled by the Authentication API.

---

# Customer Management

All customer-management endpoints operate on **customer** accounts only. Requests for a user whose `role` is not `CUSTOMER` (e.g. an admin) return `404`, so the API never reveals admin accounts to the customer-management surface.

## Customer Object

Every customer-management endpoint returns the following object:

```
{
  "public_id": "usr_…",
  "first_name": "…",
  "last_name": "…",
  "email": "…",
  "phone_number": "+…",
  "role": "CUSTOMER",
  "status": "ACTIVE" | "SUSPENDED" | "DELETED",
  "email_verified": true,
  "phone_verified": true,
  "created_at": "2026-…",
  "updated_at": "2026-…"
}
```

Internal database IDs are never exposed.

## Get Customers

```
GET /api/v1/admin/users
```

Returns a paginated list of customer accounts.

### Query parameters

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| `page` | int ≥ 1 | `1` | Page number |
| `limit` | int 1–100 | `20` | Results per page |
| `search` | string | – | Case-insensitive match on first name, last name, or email |
| `status` | enum | – | Filter by `ACTIVE`, `SUSPENDED`, or `DELETED` |
| `include_deleted` | `true`/`false` | `false` | Include soft-deleted customers |
| `sort` | enum | `-created_at` | Sort by `name`, `email`, or `created_at`; prefix `-` for descending |

### Response

```
{
  "success": true,
  "data": [ … Customer Objects … ],
  "pagination": { "page": 1, "limit": 20, "total": 42, "totalPages": 3, "hasNext": true, "hasPrev": false }
}
```

---

## Get Customer

```
GET /api/v1/admin/users/{user_public_id}
```

Returns a single customer's profile. `404` when the `user_public_id` does not exist, is an admin, or is a deleted customer (deleted customers are only reachable via the list with `include_deleted=true`).

---

## Update Customer

```
PATCH /api/v1/admin/users/{user_public_id}
```

Allows administrators to update customer information.

### Request body (all fields optional; at least one required)

| Field | Type | Constraints |
| --- | --- | --- |
| `first_name` | string | 1–100 chars |
| `last_name` | string | 1–100 chars |
| `email` | string | Valid email |
| `phone_number` | string | E.164, e.g. `+15551234567` |

### Errors

| Status | Condition |
| --- | --- |
| 404 | Customer not found (or the target is an admin) |
| 409 | `email` or `phone_number` is already used by another account |

---

## Suspend Customer

```
PATCH /api/v1/admin/users/{user_public_id}/suspend
```

Suspends a customer account and **revokes all of the customer's sessions** in a single transaction, so the account cannot log in while suspended.

### Errors

| Status | Condition |
| --- | --- |
| 400 | Customer is already suspended |
| 404 | Customer not found (or the target is an admin) |

---

## Activate Customer

```
PATCH /api/v1/admin/users/{user_public_id}/activate
```

Reactivates a suspended customer account. The customer must log in again to obtain a fresh session.

### Errors

| Status | Condition |
| --- | --- |
| 400 | Customer is already active |
| 404 | Customer not found (or the target is an admin) |

---

# Role Management

## Role Hierarchy

There are three roles: `CUSTOMER` < `ADMIN` < `SUPER_ADMIN`.

- `SUPER_ADMIN` is **CLI-only**: it is granted solely by the Admin Bootstrap CLI (`npm run admin:create`, see `docs/OPERATIONS.md`). The **first user promoted** by the CLI becomes the `SUPER_ADMIN`; every later promotion becomes `ADMIN`.
- There is **exactly one** `SUPER_ADMIN`. The API never accepts `SUPER_ADMIN` as a target role, and a `SUPER_ADMIN` can never be demoted — so the single super admin is permanent.
- `SUPER_ADMIN` has full access to all admin modules and is the **only** role that can change other users' roles.

## Change User Role

```
PATCH /api/v1/admin/users/{user_public_id}/role
```

Promotes a customer to `ADMIN` or demotes an admin back to `CUSTOMER`.

### Request body

| Field | Type | Constraints |
| --- | --- | --- |
| `role` | enum | `CUSTOMER` or `ADMIN` (`SUPER_ADMIN` is rejected with `400` — it is CLI-only) |

### Authorization

- The endpoint requires an authenticated session with the `super_admin` role. A regular `ADMIN` gets **403** on any role change (promote, demote, or no-op).
- An admin **cannot change their own role**.
- The `SUPER_ADMIN`'s role can never be changed by anyone — the self-change rule already blocks self-demotion, and targeting another `SUPER_ADMIN` (defensively) returns `403`.

### Behavior

- A no-op request (target already has the requested role) is **idempotent**: returns `200` with the unchanged role.
- Demoting an admin is rejected with **409** when it would leave **zero** admin-privileged users (`ADMIN` or `SUPER_ADMIN`). Because a `SUPER_ADMIN` always exists and can never be demoted, this guard effectively only triggers if the target is the sole admin-privileged account left.
- Every successful role change is recorded via the structured logger with `actorId`, `targetUserId`, `previousRole`, and `newRole` (an audit-log table is a documented future enhancement).

### Response

```
{
  "success": true,
  "data": { "public_id": "usr_…", "role": "ADMIN" }
}
```

### Errors

| Status | Condition |
| --- | --- |
| 400 | Admin tries to change their own role, or `role` is `SUPER_ADMIN`/invalid |
| 403 | Actor is not a `SUPER_ADMIN`, or target role is `SUPER_ADMIN` |
| 404 | Target user not found |
| 409 | Demoting the last admin-privileged user |

---

# Product Management

```
GET    /api/v1/admin/products
POST   /api/v1/admin/products

GET    /api/v1/admin/products/{product_public_id}
PATCH  /api/v1/admin/products/{product_public_id}
DELETE /api/v1/admin/products/{product_public_id}
```

---

# Category Management

```
GET    /api/v1/admin/categories
POST   /api/v1/admin/categories

PATCH  /api/v1/admin/categories/{category_public_id}
DELETE /api/v1/admin/categories/{category_public_id}
```

---

# Inventory Management

Inventory is a 1:1 child of a product variant. The `inventory` table has no public ID of its own, so inventory records are keyed by the owning variant's public ID (`variant_public_id`). Full contract: `docs/api/inventory/inventory.md`.

```
GET    /api/v1/admin/inventory
POST   /api/v1/admin/inventory

GET    /api/v1/admin/inventory/{variant_public_id}
PATCH  /api/v1/admin/inventory/{variant_public_id}
```

---

# Order Management

```
GET /api/v1/admin/orders

GET /api/v1/admin/orders/{order_public_id}

PATCH /api/v1/admin/orders/{order_public_id}
```

---

# Review Moderation

```
GET /api/v1/admin/reviews

DELETE /api/v1/admin/reviews/{review_public_id}
```

---

# Error Responses

| Status | Reason |
| --- | --- |
| 400 Bad Request | Invalid request |
| 401 Unauthorized | Authentication required |
| 403 Forbidden | Insufficient permissions |
| 404 Not Found | Resource not found |
| 422 Unprocessable Entity | Validation failed |
| 500 Internal Server Error | Unexpected server error |

---

# Notes

- All administrator actions should be recorded in audit logs. Today, role changes are written to the structured logger; a dedicated audit-log table is a documented future enhancement.
- Internal database IDs are never exposed.
- Public IDs are used for all resources.
- All list endpoints should support pagination, filtering, and sorting.
- The `SUPER_ADMIN` role is permanent and CLI-only; recovering a lost super admin requires manual database intervention (see `docs/OPERATIONS.md`).