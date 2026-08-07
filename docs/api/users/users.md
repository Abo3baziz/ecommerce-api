# Users API

## Overview

The Users API provides endpoints for retrieving and managing the authenticated user's profile information.

Authentication and session management are handled by the Authentication API.

---

# User Object

```json
{
  "public_id": "usr_01K4X8Y9P4M4G8N6F9V2A1B3C",
  "first_name": "Ahmed",
  "last_name": "Aziz",
  "email": "ahmed@example.com",
  "phone_number": "+201234567890",
  "email_verified": true,
  "created_at": "2026-07-29T12:00:00Z",
  "updated_at": "2026-07-29T12:00:00Z"
}
```

---

# Get Current User

Returns the authenticated user's profile.

## Endpoint

```
GET /api/v1/users/me
```

## Authentication

Required

---

## Response

**200 OK**

```json
{
  "public_id": "usr_01K4X8Y9P4M4G8N6F9V2A1B3C",
  "first_name": "Ahmed",
  "last_name": "Aziz",
  "email": "ahmed@example.com",
  "phone_number": "+201234567890",
  "email_verified": true,
  "created_at": "2026-07-29T12:00:00Z",
  "updated_at": "2026-07-29T12:00:00Z"
}
```

---

# Update Current User

Updates editable profile information.

## Endpoint

```
PATCH /api/v1/users/me
```

## Authentication

Required

---

## Request Body

All fields are optional.

```json
{
  "first_name": "Ahmed",
  "last_name": "Mohamed"
}
```

### Editable Fields

| Field | Editable |
| --- | --- |
| first_name | ✅ |
| last_name | ✅ |

The following fields are managed through dedicated endpoints:

- Email
- Phone number
- Password

---

## Response

**200 OK**

```json
{
  "public_id": "usr_01K4X8Y9P4M4G8N6F9V2A1B3C",
  "first_name": "Ahmed",
  "last_name": "Mohamed",
  "email": "ahmed@example.com",
  "phone_number": "+201234567890",
  "email_verified": true,
  "created_at": "2026-07-29T12:00:00Z",
  "updated_at": "2026-07-30T09:14:22Z"
}
```

---

# Delete Current User

Deletes the authenticated user's account.

## Endpoint

```
DELETE /api/v1/users/me
```

## Authentication

Required

---

## Request Body

```json
{
  "password": "CurrentPassword123!"
}
```

---

## Response

**204 No Content**

---

# Error Responses

| Status | Reason |
| --- | --- |
| 400 Bad Request | Invalid request |
| 401 Unauthorized | Authentication required |
| 403 Forbidden | Operation not permitted |
| 404 Not Found | User not found |
| 422 Unprocessable Entity | Validation failed |
| 500 Internal Server Error | Unexpected server error |

---

# Notes

- Internal database IDs are never exposed.
- Public IDs uniquely identify users externally.
- Email, password, and phone number changes are handled by dedicated authentication endpoints.
- Every endpoint requires a valid authenticated session.