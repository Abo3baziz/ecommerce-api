# Addresses API

## Overview

The Addresses API provides endpoints for managing the authenticated user's saved addresses.

Each address belongs to a single user and can be used as a shipping and/or billing address during checkout. Orders store a snapshot of the selected address at checkout time, so updating or deleting a saved address never changes historical order data.

Authentication and session management are handled by the Authentication API.

---

# Address Object

```json
{
  "public_id": "adr_01K4X8Y9P4M4G8N6F9V2A1B3C",
  "recipient_name": "Ahmed Aziz",
  "phone_number": "+201234567890",
  "label": "Home",
  "country": "Egypt",
  "state": "Cairo",
  "city": "Cairo",
  "address_1": "12 Tahrir Square",
  "address_2": "Apartment 5",
  "zip_code": "11511",
  "is_default_shipping": true,
  "is_default_billing": false,
  "created_at": "2026-08-01T10:00:00Z",
  "updated_at": "2026-08-01T10:00:00Z"
}
```

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| public_id | string | No | Public address identifier |
| recipient_name | string | No | Full name of the recipient |
| phone_number | string | No | Recipient contact phone number |
| label | string | Yes | User-defined label (e.g., Home, Work) |
| country | string | No | Country |
| state | string | No | State, province, or governorate |
| city | string | No | City |
| address_1 | string | No | Primary street address |
| address_2 | string | Yes | Secondary address information (e.g., apartment, suite) |
| zip_code | string | Yes | Postal or ZIP code |
| is_default_shipping | boolean | No | Whether this is the user's default shipping address |
| is_default_billing | boolean | No | Whether this is the user's default billing address |
| created_at | string | No | Creation timestamp (ISO 8601) |
| updated_at | string | No | Last modification timestamp (ISO 8601) |

### Default Address Invariant

At most one address per user can be the default shipping address, and at most one can be the default billing address.

The service enforces this invariant inside a database transaction: when an address is created or updated with `is_default_shipping: true` (or `is_default_billing: true`), the matching flag is cleared on all of the user's other addresses.

---

# List Addresses

Returns the authenticated user's non-deleted addresses, newest first.

## Endpoint

```
GET /api/v1/users/me/addresses
```

## Authentication

Required

---

## Query Parameters

| Parameter | Type | Default | Description |
| --- | --- | --- | --- |
| page | integer | 1 | Page number (1-based) |
| limit | integer | 20 | Page size (max 100) |

---

## Response

**200 OK**

```json
{
  "success": true,
  "data": [
    {
      "public_id": "adr_01K4X8Y9P4M4G8N6F9V2A1B3C",
      "recipient_name": "Ahmed Aziz",
      "phone_number": "+201234567890",
      "label": "Home",
      "country": "Egypt",
      "state": "Cairo",
      "city": "Cairo",
      "address_1": "12 Tahrir Square",
      "address_2": "Apartment 5",
      "zip_code": "11511",
      "is_default_shipping": true,
      "is_default_billing": false,
      "created_at": "2026-08-01T10:00:00Z",
      "updated_at": "2026-08-01T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1,
    "hasNext": false,
    "hasPrev": false
  }
}
```

---

# Create Address

Creates a new address for the authenticated user.

## Endpoint

```
POST /api/v1/users/me/addresses
```

## Authentication

Required

---

## Request Body

| Field | Type | Required | Validation Rules |
| --- | --- | --- | --- |
| recipient_name | string | Yes | 1-100 characters |
| phone_number | string | Yes | 1-20 characters |
| label | string | No | Max 50 characters |
| country | string | Yes | 1-100 characters |
| state | string | Yes | 1-100 characters |
| city | string | Yes | 1-100 characters |
| address_1 | string | Yes | 1-100 characters |
| address_2 | string | No | Max 100 characters |
| zip_code | string | No | Max 20 characters |
| is_default_shipping | boolean | No | Defaults per rule below |
| is_default_billing | boolean | No | Defaults per rule below |

### Example

```json
{
  "recipient_name": "Ahmed Aziz",
  "phone_number": "+201234567890",
  "label": "Home",
  "country": "Egypt",
  "state": "Cairo",
  "city": "Cairo",
  "address_1": "12 Tahrir Square",
  "address_2": "Apartment 5",
  "zip_code": "11511",
  "is_default_shipping": true,
  "is_default_billing": false
}
```

If `is_default_shipping` / `is_default_billing` are omitted, the new address becomes the default of that type only when the user has no other non-deleted address of that type; otherwise it is created as non-default.

---

## Response

**201 Created**

Returns the created Address Object:

```json
{
  "success": true,
  "data": {
    "public_id": "adr_01K4X8Y9P4M4G8N6F9V2A1B3C",
    "recipient_name": "Ahmed Aziz",
    "phone_number": "+201234567890",
    "label": "Home",
    "country": "Egypt",
    "state": "Cairo",
    "city": "Cairo",
    "address_1": "12 Tahrir Square",
    "address_2": "Apartment 5",
    "zip_code": "11511",
    "is_default_shipping": true,
    "is_default_billing": false,
    "created_at": "2026-08-01T10:00:00Z",
    "updated_at": "2026-08-01T10:00:00Z"
  }
}
```

---

# Get Address

Returns a single address owned by the authenticated user.

## Endpoint

```
GET /api/v1/users/me/addresses/{address_public_id}
```

## Authentication

Required

---

## Response

**200 OK**

```json
{
  "success": true,
  "data": {
    "public_id": "adr_01K4X8Y9P4M4G8N6F9V2A1B3C",
    "recipient_name": "Ahmed Aziz",
    "phone_number": "+201234567890",
    "label": "Home",
    "country": "Egypt",
    "state": "Cairo",
    "city": "Cairo",
    "address_1": "12 Tahrir Square",
    "address_2": "Apartment 5",
    "zip_code": "11511",
    "is_default_shipping": true,
    "is_default_billing": false,
    "created_at": "2026-08-01T10:00:00Z",
    "updated_at": "2026-08-01T10:00:00Z"
  }
}
```

**404 Not Found**

Returned when the address does not exist, is soft-deleted, or belongs to another user (to avoid leaking which addresses exist).

---

# Update Address

Updates editable fields of an address owned by the authenticated user. Partial update semantics: only the provided fields are changed.

## Endpoint

```
PATCH /api/v1/users/me/addresses/{address_public_id}
```

## Authentication

Required

---

## Request Body

All fields are optional and follow the same validation rules as Create Address.

```json
{
  "label": "Work",
  "is_default_shipping": true
}
```

When `is_default_shipping: true` or `is_default_billing: true` is provided, the service clears the matching flag on the user's other addresses within the same transaction (see Default Address Invariant).

---

## Response

**200 OK**

Returns the updated Address Object:

```json
{
  "success": true,
  "data": {
    "public_id": "adr_01K4X8Y9P4M4G8N6F9V2A1B3C",
    "recipient_name": "Ahmed Aziz",
    "phone_number": "+201234567890",
    "label": "Work",
    "country": "Egypt",
    "state": "Cairo",
    "city": "Cairo",
    "address_1": "12 Tahrir Square",
    "address_2": "Apartment 5",
    "zip_code": "11511",
    "is_default_shipping": true,
    "is_default_billing": false,
    "created_at": "2026-08-01T10:00:00Z",
    "updated_at": "2026-08-02T14:30:00Z"
  }
}
```

**404 Not Found**

Returned when the address does not exist, is soft-deleted, or belongs to another user.

---

# Delete Address

Soft-deletes an address owned by the authenticated user. The record is retained in the database with a `deleted_at` timestamp and is excluded from all subsequent reads.

Soft deletion (rather than hard deletion) preserves the foreign-key reference from orders and guarantees historical order data remains intact.

## Endpoint

```
DELETE /api/v1/users/me/addresses/{address_public_id}
```

## Authentication

Required

---

## Response

**204 No Content**

**404 Not Found**

Returned when the address does not exist, is already soft-deleted, or belongs to another user.

---

# Error Responses

| Status | Reason |
| --- | --- |
| 400 Bad Request | Invalid request body or query parameters |
| 401 Unauthorized | Authentication required |
| 404 Not Found | Address not found, soft-deleted, or not owned by the caller |
| 500 Internal Server Error | Unexpected server error |

---

# Notes

- Internal database IDs are never exposed; addresses are identified externally by their public ID (`adr_…` prefix).
- Deleted addresses are never returned and return 404 on direct access.
- Setting a default flag clears the previous default of the same type transactionally; the invariant holds under concurrent requests.
- Orders copy address data into immutable snapshots at checkout, so editing or deleting a saved address never alters existing orders.
- Administrative management of user addresses is not part of this API.

---

# Design Decisions

- **Resource scope** — Addresses are managed by their owner only, mirroring the `users.md` profile endpoints under `/api/v1/users/me/…`; no admin address-management endpoints are defined (addresses are not part of the documented admin capabilities).
- **API fields mirror DB columns** — Field names, nullability, and length limits follow the `user_addresses` table so the contract stays traceable to the schema. Address lines are additionally capped at 100 characters to match the `shipments` snapshot columns (`address_1`/`address_2` VarChar(100)) that checkout copies into; checkout re-validates this bound and returns 400 (never a 500) for legacy rows saved before the cap.
- **Soft delete** — `deleted_at` based deletion keeps the `orders → user_addresses` foreign key valid and matches the existing soft-delete pattern used elsewhere in the schema.
- **Default-flag enforcement** — The `@default(true)` column defaults apply only to the row being inserted; the single-default-per-type invariant is enforced by the service inside a `$transaction`.
- **Response envelope** — All responses use the shared `{ success: true, data }` wrapper, and list endpoints add the standard `pagination` object, consistent with the implemented `ApiResponse` / `PaginatedResponse` types.
