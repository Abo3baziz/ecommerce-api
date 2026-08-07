# Admin API

## Overview

The Admin API provides privileged endpoints for managing the e-commerce platform.

All endpoints require:

- Authentication
- An active session
- The `admin` role

Regular customers cannot access these endpoints.

---

# Authentication

All requests require:

- Valid authenticated session
- User role: `admin`

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

## Get Customers

```
GET /api/v1/admin/users
```

Returns a paginated list of customers.

---

## Get Customer

```
GET /api/v1/admin/users/{user_public_id}
```

Returns a customer's profile.

---

## Update Customer

```
PATCH /api/v1/admin/users/{user_public_id}
```

Allows administrators to update customer information.

---

## Suspend Customer

```
PATCH /api/v1/admin/users/{user_public_id}/suspend
```

Suspends a customer account.

---

## Activate Customer

```
PATCH /api/v1/admin/users/{user_public_id}/activate
```

Reactivates a suspended customer account.

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

```
GET   /api/v1/admin/inventory

PATCH /api/v1/admin/inventory/{inventory_public_id}
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

- All administrator actions should be recorded in audit logs.
- Internal database IDs are never exposed.
- Public IDs are used for all resources.
- All list endpoints should support pagination, filtering, and sorting.