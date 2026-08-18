# Ecommerce API — Endpoints Reference

A complete, copy-friendly reference of every HTTP endpoint exposed by the Ecommerce Backend API.

---

## Overview

### Base URL

All endpoints are versioned under:

```
https://api.example.com/api/v1
```

### Authentication

- The API uses **session-based authentication**. After a successful `POST /auth/login` (or `POST /auth/register`), the server sets an `HttpOnly` session cookie.
- Authenticated requests send the cookie automatically:
  ```
  Cookie: session=<session_token>
  ```
- Endpoints that require a session are marked **Authentication: Session required**. Endpoints that additionally require an administrator role are marked **Authorization: admin, super_admin**. The role-change endpoint (`PATCH /admin/users/{user_public_id}/role`) requires **super_admin only**.

### Response Envelope

Most endpoints wrap the payload in:

```json
{ "success": true, "data": { ... } }
```

- List endpoints add a top-level `pagination` object:
  ```json
  { "page": 1, "limit": 20, "total": 42, "totalPages": 3, "hasNext": true, "hasPrev": false }
  ```
- Reviews use a different pagination shape: `{ "page": 1, "limit": 10, "total": 12, "has_more": true }`.
- Several endpoints return a bare object, bare array, or `204 No Content` (empty body) — this is called out per endpoint.
- Auth/users/session endpoints return bare objects; addresses, products, categories, orders, reviews, and admin endpoints use the `{ success: true, data }` wrapper.

### Error Envelope

Two formats are in use:

- **Products / categories / auth / users / admin products** — `{ "error": { "code": "<ERROR_CODE>", "message": "<message>" } }`
- **Inventory / cart / orders / reviews** — `{ "success": false, "message": "<message>" }`

### Conventions

- **Public vs internal IDs:** Only public IDs are ever exposed (`usr_`, `ses_`, `adr_`, `prd_`, `var_`, `pimg_`, `vimg_`, `cat_`, `crt_`, `ord_`, `pay_`, `shp_`, `rev_`, `rvimg_`). Internal database IDs are never exposed.
- **Money:** All amounts are decimal **strings** with 2 places (e.g. `"129.99"`), never floats.
- **Timestamps:** ISO 8601 UTC strings (e.g. `2026-08-01T10:00:00Z`).
- **Pagination:** `page` is 1-based (default `1`); `limit` default `20`, max `100` unless stated otherwise.
- **Sorting:** `sort` values may be prefixed with `-` for descending (e.g. `-created_at`).
- **Required vs optional:** In request-body tables, **required** fields are marked explicitly; all others are optional.
- **Common status codes** (applied on every endpoint unless listed otherwise):
  - `400 Bad Request` — invalid body, query, or path parameter
  - `401 Unauthorized` — missing/invalid/expired session
  - `403 Forbidden` — authenticated but insufficient role
  - `404 Not Found` — resource does not exist (or is deliberately hidden)
  - `409 Conflict` — state conflict or unique-constraint violation
  - `422 Unprocessable Entity` — validation failed
  - `429 Too Many Requests` — rate limit exceeded
  - `500 Internal Server Error` — unexpected server error

### Placeholder Values

All examples use placeholders. Replace `<SESSION_TOKEN>`, `<VERIFICATION_TOKEN>`, `jane@example.com`, and `prd_01K4...`-style IDs with real values.

---

## 1. Authentication

### POST /api/v1/auth/register

**Overview:** Creates a new customer account, starts an authenticated session, and queues an email verification email. The user is signed in immediately; email verification is required before restricted operations (e.g. checkout, email change).

**Authentication:** None

**Request**

- Method: `POST` · URL: `/api/v1/auth/register`
- Headers: `Content-Type: application/json`
- Path params: None · Query params: None
- Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `first_name` | string | Yes | 1–100 characters |
| `last_name` | string | Yes | 1–100 characters |
| `phone_number` | string | Yes | E.164 format, unique |
| `email` | string | Yes | Valid email address, unique |
| `password` | string | Yes | Must meet the password policy |

**Response**

- Success: `201 Created` — bare object; `Set-Cookie: session=<token>; HttpOnly; Secure; SameSite=Lax; Path=/`

  ```json
  { "public_id": "usr_01K4...", "email_verified": false }
  ```

- Errors:

| Status | Code / Condition | Description |
| --- | --- | --- |
| 400 | — | Invalid request body |
| 409 | — | Email already exists |
| 409 | — | Phone number already exists |
| 422 | — | Password does not meet policy |
| 500 | — | Unexpected server error |

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Jane","last_name":"Doe","phone_number":"+15551234567","email":"jane@example.com","password":"StrongPassword123!"}'
```

---

### POST /api/v1/auth/login

**Overview:** Authenticates an existing user with email and password, creates a new authenticated session, and returns a session cookie.

**Authentication:** None

**Request**

- Method: `POST` · URL: `/api/v1/auth/login`
- Headers: `Content-Type: application/json`
- Path params: None · Query params: None
- Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `email` | string | Yes | Valid email address |
| `password` | string | Yes | The user's password |

**Response**

- Success: `200 OK` — bare object; `Set-Cookie: session=<token>` as above

  ```json
  { "public_id": "usr_01K4...", "email_verified": false }
  ```

- Errors:

| Status | Code / Condition | Description |
| --- | --- | --- |
| 400 | — | Invalid request body |
| 401 | `INVALID_CREDENTIALS` | Invalid email or password; identical response for both to avoid account enumeration |
| 403 | — | Account is suspended or disabled |
| 500 | — | Unexpected server error |

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"StrongPassword123!"}'
```

---

### GET /api/v1/auth/session

**Overview:** Returns information about the current authenticated session and its user.

**Authentication:** Session required

**Request**

- Method: `GET` · URL: `/api/v1/auth/session`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Query params: None · Body: None

**Response**

- Success: `200 OK`

  ```json
  {
    "authenticated": true,
    "user": { "public_id": "usr_01K4...", "email_verified": false },
    "session": { "created_at": "2026-07-29T12:00:00Z", "expires_at": "2026-08-28T12:00:00Z" }
  }
  ```

- Errors: `401` no/invalid/expired session · `500` unexpected error

**Example Request**

```bash
curl -X GET https://api.example.com/api/v1/auth/session -H "Cookie: session=<SESSION_TOKEN>"
```

---

### GET /api/v1/auth/sessions

**Overview:** Returns all active sessions for the authenticated user, marking which is the current session.

**Authentication:** Session required

**Request**

- Method: `GET` · URL: `/api/v1/auth/sessions`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Query params: None · Body: None

**Response**

- Success: `200 OK` — bare array. Each item: `public_id` (string, required), `current` (boolean, required), `device` (string), `ip_address` (string), `last_activity_at` (string ISO-8601), `created_at` (string ISO-8601).

  ```json
  [
    {
      "public_id": "ses_01K4...",
      "current": true,
      "device": "Chrome on Windows",
      "ip_address": "203.0.113.xxx",
      "last_activity_at": "2026-07-29T15:43:21Z",
      "created_at": "2026-07-29T12:00:00Z"
    }
  ]
  ```

- Errors: `401` no/invalid/expired session · `500` unexpected error

**Example Request**

```bash
curl -X GET https://api.example.com/api/v1/auth/sessions -H "Cookie: session=<SESSION_TOKEN>"
```

---

### DELETE /api/v1/auth/session

**Overview:** Invalidates the current authenticated session and clears the session cookie (logout).

**Authentication:** Session required

**Request**

- Method: `DELETE` · URL: `/api/v1/auth/session`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Query params: None · Body: None

**Response**

- Success: `204 No Content` — session invalidated, cookie cleared.
- Errors: `401` no/invalid/expired session · `500` unexpected error

**Example Request**

```bash
curl -X DELETE https://api.example.com/api/v1/auth/session -H "Cookie: session=<SESSION_TOKEN>"
```

---

### DELETE /api/v1/auth/sessions

**Overview:** Invalidates every active session except the current one (logout all other sessions).

**Authentication:** Session required

**Request**

- Method: `DELETE` · URL: `/api/v1/auth/sessions`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Query params: None · Body: None

**Response**

- Success: `204 No Content`
- Errors: `401` no/invalid/expired session · `500` unexpected error

**Example Request**

```bash
curl -X DELETE https://api.example.com/api/v1/auth/sessions -H "Cookie: session=<SESSION_TOKEN>"
```

---

### DELETE /api/v1/auth/sessions/{session_public_id}

**Overview:** Terminates one specific active session of the authenticated user.

**Authentication:** Session required

**Request**

- Method: `DELETE` · URL: `/api/v1/auth/sessions/{session_public_id}`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `session_public_id` | string | Yes | Public ID of the session to revoke (`ses_...`) |

- Query params: None · Body: None

**Response**

- Success: `204 No Content`
- Errors: `400` invalid session ID · `401` no/invalid/expired session · `500` unexpected error

**Example Request**

```bash
curl -X DELETE https://api.example.com/api/v1/auth/sessions/ses_01K4EXAMPLE \
  -H "Cookie: session=<SESSION_TOKEN>"
```

---

### POST /api/v1/auth/email-verification/verify

**Overview:** Verifies the user's email address using a single-use, time-limited verification token. Does not create a new session.

**Authentication:** None (token-based)

**Request**

- Method: `POST` · URL: `/api/v1/auth/email-verification/verify`
- Headers: `Content-Type: application/json`
- Path params: None · Query params: None
- Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `token` | string | Yes | Email verification token from the verification link |

**Response**

- Success: `200 OK`

  ```json
  { "message": "Email verified successfully." }
  ```

- Errors:

| Status | Code / Condition | Description |
| --- | --- | --- |
| 400 | — | Invalid request body/token |
| 404 | — | Verification token not found |
| 410 | — | Token expired or already used |
| 500 | — | Unexpected server error |

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/auth/email-verification/verify \
  -H "Content-Type: application/json" \
  -d '{"token":"<VERIFICATION_TOKEN>"}'
```

---

### POST /api/v1/auth/email-verification/resend

**Overview:** Sends (or re-sends) an email verification email to the authenticated user. Invalidates previous unused tokens and queues a new one.

**Authentication:** Session required

**Request**

- Method: `POST` · URL: `/api/v1/auth/email-verification/resend`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Query params: None · Body: None

**Response**

- Success: `202 Accepted`

  ```json
  { "message": "Verification email sent." }
  ```

- Errors:

| Status | Condition | Description |
| --- | --- | --- |
| 401 | — | Authentication required |
| 409 | — | Email already verified |
| 429 | — | Rate limit exceeded |
| 500 | — | Unexpected server error |

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/auth/email-verification/resend \
  -H "Cookie: session=<SESSION_TOKEN>"
```

---

## 2. Users

### GET /api/v1/users/me

**Overview:** Returns the authenticated user's profile.

**Authentication:** Session required

**Request**

- Method: `GET` · URL: `/api/v1/users/me`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Query params: None · Body: None

**Response**

- Success: `200 OK` — bare User Object:

  ```json
  {
    "public_id": "usr_01K4...",
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane@example.com",
    "phone_number": "+15551234567",
    "email_verified": true,
    "created_at": "2026-07-29T12:00:00Z",
    "updated_at": "2026-07-29T12:00:00Z"
  }
  ```

- Errors: `401` authentication required · `404` user not found · `500` unexpected error

**Example Request**

```bash
curl -X GET https://api.example.com/api/v1/users/me -H "Cookie: session=<SESSION_TOKEN>"
```

---

### PATCH /api/v1/users/me

**Overview:** Updates the editable profile fields of the authenticated user. Email, phone number, and password are managed via dedicated endpoints.

**Authentication:** Session required

**Request**

- Method: `PATCH` · URL: `/api/v1/users/me`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Query params: None
- Request body: partial update — all fields optional.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `first_name` | string | No | 1–100 characters |
| `last_name` | string | No | 1–100 characters |

**Response**

- Success: `200 OK` — updated User Object (same shape as `GET /users/me`, with `updated_at` refreshed).
- Errors: `400` invalid request · `401` authentication required · `404` user not found · `422` validation failed · `500` unexpected error

**Example Request**

```bash
curl -X PATCH https://api.example.com/api/v1/users/me \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Jane","last_name":"Smith"}'
```

---

### DELETE /api/v1/users/me

**Overview:** Deletes the authenticated user's account. Requires the current password for confirmation.

**Authentication:** Session required

**Request**

- Method: `DELETE` · URL: `/api/v1/users/me`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Query params: None
- Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `password` | string | Yes | The current account password |

**Response**

- Success: `204 No Content`
- Errors: `400` invalid request · `401` authentication required or invalid password · `403` operation not permitted · `404` user not found · `422` validation failed · `500` unexpected error

**Example Request**

```bash
curl -X DELETE https://api.example.com/api/v1/users/me \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"password":"CurrentPassword123!"}'
```

---

### PATCH /api/v1/users/me/password

**Overview:** Changes the authenticated user's password. Requires the current password; all other sessions are invalidated while the current session stays active.

**Authentication:** Session required

**Request**

- Method: `PATCH` · URL: `/api/v1/users/me/password`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Query params: None
- Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `current_password` | string | Yes | Must be correct |
| `new_password` | string | Yes | Must meet the password policy and differ from the current password |

**Response**

- Success: `204 No Content`
- Errors:

| Status | Code / Condition | Description |
| --- | --- | --- |
| 400 | — | Invalid request |
| 401 | `INVALID_CURRENT_PASSWORD` | The current password is incorrect, or authentication required |
| 422 | — | New password does not meet the password policy |
| 429 | — | Rate limit exceeded (password change limiter) |
| 500 | — | Unexpected server error |

**Example Request**

```bash
curl -X PATCH https://api.example.com/api/v1/users/me/password \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"current_password":"CurrentPassword123!","new_password":"NewStrongPassword456!"}'
```

---

### POST /api/v1/users/me/email

**Overview:** Requests a change to the authenticated user's email. Requires password confirmation; a verification email is sent to the new address and the email is not changed until verified.

**Authentication:** Session required

**Request**

- Method: `POST` · URL: `/api/v1/users/me/email`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Query params: None
- Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `new_email` | string | Yes | Valid email, different from current, not already in use |
| `password` | string | Yes | Current password confirmation |

**Response**

- Success: `202 Accepted`

  ```json
  { "message": "Verification email sent." }
  ```

- Errors: `400` invalid request · `401` invalid password or authentication required · `409` email already exists · `429` rate limit exceeded · `500` unexpected error

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/users/me/email \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"new_email":"jane.new@example.com","password":"CurrentPassword123!"}'
```

---

### POST /api/v1/users/me/email/verify

**Overview:** Verifies a pending email change using the single-use, time-limited token sent to the new address, then applies the new email.

**Authentication:** Session required

**Request**

- Method: `POST` · URL: `/api/v1/users/me/email/verify`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Query params: None
- Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `token` | string | Yes | Email change verification token |

**Response**

- Success: `200 OK`

  ```json
  { "message": "Email updated successfully.", "email": "jane.new@example.com", "email_verified": true }
  ```

- Errors: `400` invalid request · `401` authentication required · `404` verification token not found · `410` token expired or already used · `500` unexpected error

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/users/me/email/verify \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"token":"<VERIFICATION_TOKEN>"}'
```

---

### POST /api/v1/users/me/phone-number

**Overview:** Requests a change to the authenticated user's phone number. Requires password confirmation; an OTP is sent via SMS to the new number, which is not applied until verified.

**Authentication:** Session required

**Request**

- Method: `POST` · URL: `/api/v1/users/me/phone-number`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Query params: None
- Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `new_phone_number` | string | Yes | Valid phone number, different from current, not already in use |
| `password` | string | Yes | Current password confirmation |

**Response**

- Success: `202 Accepted`

  ```json
  { "message": "Verification code sent." }
  ```

- Errors: `400` invalid request · `401` invalid password or authentication required · `409` phone number already exists · `429` rate limit exceeded · `500` unexpected error

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/users/me/phone-number \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"new_phone_number":"+15559876543","password":"CurrentPassword123!"}'
```

---

### POST /api/v1/users/me/phone-number/verify

**Overview:** Verifies a pending phone number change with the OTP sent via SMS, then applies the new phone number.

**Authentication:** Session required

**Request**

- Method: `POST` · URL: `/api/v1/users/me/phone-number/verify`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Query params: None
- Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `otp` | string | Yes | The one-time verification code |

**Response**

- Success: `200 OK`

  ```json
  { "message": "Phone number updated successfully.", "phone_number": "+15559876543" }
  ```

- Errors: `400` invalid request · `401` authentication required · `404` verification request not found · `410` verification code expired · `422` invalid verification code · `429` too many verification attempts · `500` unexpected error

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/users/me/phone-number/verify \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"otp":"123456"}'
```

---

## 3. Addresses

**Address Object**

```json
{
  "public_id": "adr_01K4...",
  "recipient_name": "Jane Doe",
  "phone_number": "+15551234567",
  "label": "Home",
  "country": "US",
  "state": "NY",
  "city": "New York",
  "address_1": "1 Main St",
  "address_2": "Apt 5",
  "zip_code": "10001",
  "is_default_shipping": true,
  "is_default_billing": false,
  "created_at": "2026-08-01T10:00:00Z",
  "updated_at": "2026-08-01T10:00:00Z"
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `public_id` | string | Yes | Public address identifier (`adr_...`) |
| `recipient_name` | string | Yes | Full name of the recipient |
| `phone_number` | string | Yes | Recipient contact phone number |
| `label` | string | No | User-defined label (e.g. Home, Work) |
| `country` | string | Yes | Country |
| `state` | string | Yes | State, province, or governorate |
| `city` | string | Yes | City |
| `address_1` | string | Yes | Primary street address |
| `address_2` | string | No | Secondary address info (apartment, suite) |
| `zip_code` | string | No | Postal or ZIP code |
| `is_default_shipping` | boolean | Yes | Is the default shipping address |
| `is_default_billing` | boolean | Yes | Is the default billing address |
| `created_at` | string | Yes | Creation timestamp (ISO 8601 UTC) |
| `updated_at` | string | Yes | Last modification timestamp |

### GET /api/v1/users/me/addresses

**Overview:** Lists the authenticated user's non-deleted addresses, newest first.

**Authentication:** Session required

**Request**

- Method: `GET` · URL: `/api/v1/users/me/addresses`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Body: None
- Query params:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `page` | integer | No | Page number (default `1`) |
| `limit` | integer | No | Page size (default `20`, max `100`) |

**Response**

- Success: `200 OK` — enveloped list with pagination.

  ```json
  {
    "success": true,
    "data": [ { "public_id": "adr_01K4...", "recipient_name": "Jane Doe", "zip_code": "10001" } ],
    "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1, "hasNext": false, "hasPrev": false }
  }
  ```

- Errors: `400` invalid query parameters · `401` authentication required · `500` unexpected error

**Example Request**

```bash
curl -X GET "https://api.example.com/api/v1/users/me/addresses?page=1&limit=20" \
  -H "Cookie: session=<SESSION_TOKEN>"
```

---

### POST /api/v1/users/me/addresses

**Overview:** Creates a new address for the authenticated user.

**Authentication:** Session required

**Request**

- Method: `POST` · URL: `/api/v1/users/me/addresses`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Query params: None
- Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `recipient_name` | string | Yes | 1–100 characters |
| `phone_number` | string | Yes | 1–20 characters |
| `label` | string | No | Max 50 characters |
| `country` | string | Yes | 1–100 characters |
| `state` | string | Yes | 1–100 characters |
| `city` | string | Yes | 1–100 characters |
| `address_1` | string | Yes | 1–255 characters |
| `address_2` | string | No | Max 255 characters |
| `zip_code` | string | No | Max 20 characters |
| `is_default_shipping` | boolean | No | Defaults to `true` only when the user has no other non-deleted shipping address; otherwise `false` |
| `is_default_billing` | boolean | No | Same rule as `is_default_shipping` |

**Response**

- Success: `201 Created` — enveloped Address Object.
- Errors: `400` invalid request body · `401` authentication required · `422` validation failed · `500` unexpected error

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/users/me/addresses \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"recipient_name":"Jane Doe","phone_number":"+15551234567","label":"Home","country":"US","state":"NY","city":"New York","address_1":"1 Main St","address_2":"Apt 5","zip_code":"10001","is_default_shipping":true,"is_default_billing":false}'
```

---

### GET /api/v1/users/me/addresses/{address_public_id}

**Overview:** Returns a single address owned by the authenticated user.

**Authentication:** Session required

**Request**

- Method: `GET` · URL: `/api/v1/users/me/addresses/{address_public_id}`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `address_public_id` | string | Yes | Public address ID (`adr_...`) |

- Query params: None · Body: None

**Response**

- Success: `200 OK` — enveloped Address Object.
- Errors: `400` invalid address ID · `401` authentication required · `404` address does not exist, is soft-deleted, or belongs to another user (deliberately ambiguous) · `500` unexpected error

**Example Request**

```bash
curl -X GET https://api.example.com/api/v1/users/me/addresses/adr_01K4EXAMPLE \
  -H "Cookie: session=<SESSION_TOKEN>"
```

---

### PATCH /api/v1/users/me/addresses/{address_public_id}

**Overview:** Updates editable fields of an address owned by the authenticated user. Partial update — only provided fields change.

**Authentication:** Session required

**Request**

- Method: `PATCH` · URL: `/api/v1/users/me/addresses/{address_public_id}`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: `address_public_id` (string, required, `adr_...`)
- Query params: None
- Request body: all fields optional; same validation rules as Create Address. Setting `is_default_shipping` / `is_default_billing` to `true` clears the same-type flag on the user's other addresses.

**Response**

- Success: `200 OK` — enveloped updated Address Object.
- Errors: `400` invalid body or address ID · `401` authentication required · `404` address does not exist, is soft-deleted, or belongs to another user · `422` validation failed · `500` unexpected error

**Example Request**

```bash
curl -X PATCH https://api.example.com/api/v1/users/me/addresses/adr_01K4EXAMPLE \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"label":"Work","is_default_shipping":true}'
```

---

### DELETE /api/v1/users/me/addresses/{address_public_id}

**Overview:** Soft-deletes an address owned by the authenticated user (record kept with `deleted_at`, excluded from reads, preserving order snapshots).

**Authentication:** Session required

**Request**

- Method: `DELETE` · URL: `/api/v1/users/me/addresses/{address_public_id}`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: `address_public_id` (string, required, `adr_...`)
- Query params: None · Body: None

**Response**

- Success: `204 No Content`
- Errors: `400` invalid address ID · `401` authentication required · `404` address does not exist, is already soft-deleted, or belongs to another user · `500` unexpected error

**Example Request**

```bash
curl -X DELETE https://api.example.com/api/v1/users/me/addresses/adr_01K4EXAMPLE \
  -H "Cookie: session=<SESSION_TOKEN>"
```

---

## 4. Products — Public Catalog

**Product Object (list)**

```json
{
  "public_id": "prd_01K4...",
  "slug": "wireless-noise-cancelling-headphones",
  "name": "Wireless Noise-Cancelling Headphones",
  "description": "Premium over-ear headphones...",
  "brand": "SoundWave",
  "created_at": "2026-08-01T10:00:00Z",
  "updated_at": "2026-08-02T09:00:00Z"
}
```

### GET /api/v1/products

**Overview:** Returns a paginated list of products available for purchase. Only non-deleted products that have at least one non-deleted variant with `status = ACTIVE` are returned.

**Authentication:** None

**Request**

- Method: `GET` · URL: `/api/v1/products`
- Path params: None · Headers: None · Body: None
- Query params:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `page` | integer | No | Page number, 1-based (default `1`) |
| `limit` | integer | No | Page size (default `20`, max `100`) |
| `search` | string | No | Case-insensitive substring match against `name`, `brand`, `description` |
| `brand` | string | No | Case-insensitive exact brand filter |
| `sort` | string | No | Sort field with optional `-` prefix. Allowed: `name`, `created_at`, `updated_at`. Default `-created_at` |

**Response**

- Success: `200 OK` — enveloped list of Product Objects with pagination.
- Errors: `400` invalid `page`/`limit`/`sort` · `500` unexpected error

**Example Request**

```bash
curl "https://api.example.com/api/v1/products?page=1&limit=20&search=wireless&brand=SoundWave&sort=-created_at"
```

---

### GET /api/v1/products/{product_public_id}

**Overview:** Returns a single product with its active variants (customer-facing shape) and images for the storefront.

**Authentication:** None

**Request**

- Method: `GET` · URL: `/api/v1/products/{product_public_id}`
- Path params: `product_public_id` (string, required, `prd_...`)
- Query params: None · Headers: None · Body: None

**Response**

- Success: `200 OK` — enveloped Product Detail Object:

  ```json
  {
    "success": true,
    "data": {
      "public_id": "prd_01K4...",
      "slug": "wireless-noise-cancelling-headphones",
      "name": "Wireless Noise-Cancelling Headphones",
      "description": "Premium over-ear headphones...",
      "brand": "SoundWave",
      "created_at": "2026-08-01T10:00:00Z",
      "updated_at": "2026-08-02T09:00:00Z",
      "variants": [
        {
          "public_id": "var_01K4...",
          "sku": "SW-HP-001-BLK-M",
          "color": "Black",
          "size": "M",
          "price": "129.99",
          "discount_percentage": "10.00",
          "final_price": "116.99",
          "weight": "0.25",
          "images": [
            {
              "public_id": "vimg_01K4...",
              "image_url": "https://cdn.example.com/.../black-side.jpg",
              "alt_text": "Wireless headphones in black, side view",
              "display_order": 1
            }
          ]
        }
      ],
      "images": [
        {
          "public_id": "pimg_01K4...",
          "image_url": "https://cdn.example.com/.../hero.jpg",
          "alt_text": "Wireless headphones in black",
          "display_order": 1,
          "is_primary": true
        }
      ]
    }
  }
  ```

  Embedded variant: `public_id`, `sku`, `color` (optional), `size` (optional), `price`, `discount_percentage` (optional), `final_price` (computed), `weight` (optional), `images`. Internal fields (`cost_price`, dimensions, `status`, `barcode`) are never exposed.

- Errors: `400` malformed public ID · `404` product does not exist, is soft-deleted, or has no active variant (single response to avoid leaking existence) · `500` unexpected error

**Example Request**

```bash
curl "https://api.example.com/api/v1/products/prd_01K4X8Y9P4M4G8N6F9V2A1B3C"
```

---

## 5. Products — Admin

All admin product endpoints require a session and the `admin` or `super_admin` role.

### GET /api/v1/admin/products/uploads/imagekit-auth

**Overview:** Returns short-lived signed parameters (`token`, `expire`, `signature`) plus the ImageKit public key and URL endpoint, authorizing a client-side upload to ImageKit without exposing the private key. Shared by product and variant image uploads.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `GET` · URL: `/api/v1/admin/products/uploads/imagekit-auth`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Query params: None · Body: None

**Response**

- Success: `200 OK`

  ```json
  {
    "success": true,
    "data": {
      "token": "03b057f3-7dd9-4689-b16a-bcd0176bfc65",
      "expire": 1786240129,
      "signature": "c593fd35ccb285b290b4f838d6f51053a3426cf2",
      "publicKey": "public_JP5I0TzT4ZAdJMgOCbgY9Ogv6Kk=",
      "urlEndpoint": "https://ik.imagekit.io/ecommerceImages"
    }
  }
  ```

  Fields: `token` (string), `expire` (number, Unix seconds), `signature` (string), `publicKey` (string), `urlEndpoint` (string).

- Errors: `401` missing/invalid session · `403` not admin · `500` unexpected error

**Example Request**

```bash
curl -H "Cookie: session=<SESSION_TOKEN>" "https://api.example.com/api/v1/admin/products/uploads/imagekit-auth"
```

---

### GET /api/v1/admin/products

**Overview:** Returns a paginated list of all products, including optionally soft-deleted ones.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `GET` · URL: `/api/v1/admin/products`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Body: None
- Query params:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `page` | integer | No | Page number, 1-based (default `1`) |
| `limit` | integer | No | Page size (default `20`, max `100`) |
| `search` | string | No | Case-insensitive substring match against `name`, `brand`, `description` |
| `brand` | string | No | Case-insensitive exact brand filter |
| `include_deleted` | boolean | No | Include soft-deleted products (default `false`) |
| `sort` | string | No | Allowed: `name`, `created_at`, `updated_at`; `-` prefix for descending. Default `-created_at` |

**Response**

- Success: `200 OK` — enveloped list of Product Objects with pagination. `deleted_at` is never exposed.
- Errors: `400` invalid query parameter · `401` missing/invalid session · `403` not admin · `500` unexpected error

**Example Request**

```bash
curl -H "Cookie: session=<SESSION_TOKEN>" "https://api.example.com/api/v1/admin/products?include_deleted=true&page=1&limit=20"
```

---

### POST /api/v1/admin/products

**Overview:** Creates a new product. Slugs are optional and auto-generated from `name` when omitted.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `POST` · URL: `/api/v1/admin/products`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Query params: None
- Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `slug` | string | No | 1–255 chars, matches `^[a-z0-9]+(?:-[a-z0-9]+)*$`; auto-generated from `name` when omitted (numeric suffix `-2`, `-3`... on conflict) |
| `name` | string | Yes | 1–255 characters |
| `description` | string | No | Max 10000 characters |
| `brand` | string | No | Max 255 characters |

**Response**

- Success: `201 Created` — enveloped Product Object.
- Errors: `400` invalid body or malformed slug · `401` missing/invalid session · `403` not admin · `409` `PRODUCT_SLUG_TAKEN` ("A product with this slug already exists.") · `500` unexpected error

**Example Request**

```bash
curl -X POST "https://api.example.com/api/v1/admin/products" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -d '{"slug":"wireless-noise-cancelling-headphones","name":"Wireless Noise-Cancelling Headphones","description":"Premium over-ear headphones.","brand":"SoundWave"}'
```

---

### GET /api/v1/admin/products/{product_public_id}

**Overview:** Returns a single product with all of its variants and images, including soft-deleted variants when requested. Admin detail is the superset of the customer detail (exposes `cost_price`, dimensions, `barcode`, `status`).

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `GET` · URL: `/api/v1/admin/products/{product_public_id}`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: `product_public_id` (string, required, `prd_...`)
- Query params: `include_deleted_variants` (boolean, optional, default `false`)
- Body: None

**Response**

- Success: `200 OK` — enveloped Admin Product Detail Object: product fields plus `variants` (full admin shape incl. `cost_price`, `barcode`, dimensions, `status`; statuses `ACTIVE`/`DRAFT`/`INACTIVE`/`ARCHIVED`) and `images` (Product Image Object with timestamps). Images ordered by `display_order` ascending.
- Errors: `400` malformed public ID · `401` missing/invalid session · `403` not admin · `404` product does not exist or is soft-deleted · `500` unexpected error

**Example Request**

```bash
curl -H "Cookie: session=<SESSION_TOKEN>" "https://api.example.com/api/v1/admin/products/prd_01K4X8Y9P4M4G8N6F9V2A1B3C?include_deleted_variants=true"
```

---

### PATCH /api/v1/admin/products/{product_public_id}

**Overview:** Updates editable fields of a product. Partial update — only provided fields change.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `PATCH` · URL: `/api/v1/admin/products/{product_public_id}`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: `product_public_id` (string, required, `prd_...`)
- Query params: None
- Request body: all fields optional; validation same as Create Product. `description` and `brand` accept `null` to clear.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `slug` | string | No | 1–255 chars, matches slug regex |
| `name` | string | No | 1–255 characters |
| `description` | string \| null | No | Max 10000 chars; `null` clears |
| `brand` | string \| null | No | Max 255 chars; `null` clears |

**Response**

- Success: `200 OK` — enveloped updated Product Object.
- Errors: `400` invalid body · `401` missing/invalid session · `403` not admin · `404` product not found or soft-deleted · `409` `PRODUCT_SLUG_TAKEN` · `500` unexpected error

**Example Request**

```bash
curl -X PATCH "https://api.example.com/api/v1/admin/products/prd_01K4X8Y9P4M4G8N6F9V2A1B3C" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -d '{"name":"Wireless Noise-Cancelling Headphones Pro","brand":"SoundWave Pro"}'
```

---

### DELETE /api/v1/admin/products/{product_public_id}

**Overview:** Soft-deletes a product and, in the same transaction, soft-deletes all of its variants. Records are retained with a `deleted_at` timestamp and excluded from subsequent reads.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `DELETE` · URL: `/api/v1/admin/products/{product_public_id}`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: `product_public_id` (string, required, `prd_...`)
- Query params: None · Body: None

**Response**

- Success: `204 No Content` (empty body)
- Errors: `400` malformed public ID · `401` missing/invalid session · `403` not admin · `404` product not found or already soft-deleted · `500` unexpected error

**Example Request**

```bash
curl -X DELETE -H "Cookie: session=<SESSION_TOKEN>" \
  "https://api.example.com/api/v1/admin/products/prd_01K4X8Y9P4M4G8N6F9V2A1B3C"
```

---

## 6. Product Variants — Admin

### GET /api/v1/admin/products/{product_public_id}/variants

**Overview:** Returns a paginated list of the variants belonging to a product.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `GET` · URL: `/api/v1/admin/products/{product_public_id}/variants`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: `product_public_id` (string, required, `prd_...`)
- Query params:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `page` | integer | No | Page number, 1-based (default `1`) |
| `limit` | integer | No | Page size (default `20`, max `100`) |
| `status` | string | No | Filter by `ACTIVE`, `DRAFT`, `INACTIVE`, `ARCHIVED`; omitted returns all |
| `include_deleted` | boolean | No | Include soft-deleted variants (default `false`) |
| `sort` | string | No | Allowed: `sku`, `price`, `created_at`, `updated_at`; `-` prefix for descending. Default `created_at` |

**Response**

- Success: `200 OK` — enveloped list of Variant Objects with pagination. Variant images are **not** embedded in list responses.

  ```json
  {
    "success": true,
    "data": [
      {
        "public_id": "var_01K4...",
        "product_public_id": "prd_01K4...",
        "sku": "SW-HP-001-BLK-M",
        "barcode": "4006381333931",
        "color": "Black",
        "size": "M",
        "price": "129.99",
        "cost_price": "85.00",
        "discount_percentage": "10.00",
        "weight": "0.25",
        "length": "18.00",
        "width": "16.00",
        "height": "8.00",
        "status": "ACTIVE",
        "created_at": "2026-08-01T10:30:00Z",
        "updated_at": "2026-08-01T10:30:00Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1, "hasNext": false, "hasPrev": false }
  }
  ```

- Errors: `400` invalid query parameter · `401` missing/invalid session · `403` not admin · `404` parent product not found or soft-deleted · `500` unexpected error

**Example Request**

```bash
curl -H "Cookie: session=<SESSION_TOKEN>" \
  "https://api.example.com/api/v1/admin/products/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/variants?status=ACTIVE&include_deleted=false&page=1&limit=20"
```

---

### POST /api/v1/admin/products/{product_public_id}/variants

**Overview:** Creates a new variant for a product. Default status is `ACTIVE` when omitted.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `POST` · URL: `/api/v1/admin/products/{product_public_id}/variants`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: `product_public_id` (string, required, `prd_...`)
- Query params: None
- Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `sku` | string | Yes | 1–80 chars, unique across all variants |
| `barcode` | string | No | Max 255 characters |
| `color` | string | No | Max 50 characters |
| `size` | string | No | Max 50 characters |
| `price` | string | Yes | Decimal ≥ 0, max 10 integer + 2 decimal digits |
| `cost_price` | string | No | Decimal ≥ 0 |
| `discount_percentage` | string | No | Decimal 0–100. Default `"0.00"` |
| `weight` | string | No | Decimal > 0 |
| `length` | string | No | Decimal > 0 |
| `width` | string | No | Decimal > 0 |
| `height` | string | No | Decimal > 0 |
| `status` | string | No | `ACTIVE`, `DRAFT`, `INACTIVE`, `ARCHIVED`. Default `ACTIVE` |

**Response**

- Success: `201 Created` — enveloped Variant Object.
- Errors: `400` invalid body · `401` missing/invalid session · `403` not admin · `404` parent product not found or soft-deleted · `409` `VARIANT_SKU_TAKEN` ("A variant with this SKU already exists.") · `500` unexpected error

**Example Request**

```bash
curl -X POST "https://api.example.com/api/v1/admin/products/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/variants" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -d '{"sku":"SW-HP-001-BLK-M","color":"Black","size":"M","price":"129.99","cost_price":"85.00","discount_percentage":"10.00","weight":"0.25","length":"18.00","width":"16.00","height":"8.00","status":"ACTIVE"}'
```

---

### GET /api/v1/admin/products/{product_public_id}/variants/{variant_public_id}

**Overview:** Returns a single variant with its images ordered by `display_order` ascending.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `GET` · URL: `/api/v1/admin/products/{product_public_id}/variants/{variant_public_id}`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `product_public_id` | string | Yes | Public product identifier (`prd_...`) |
| `variant_public_id` | string | Yes | Public variant identifier (`var_...`) |

- Query params: None · Body: None

**Response**

- Success: `200 OK` — enveloped Variant Object with embedded `images` (Variant Image Objects carry no timestamps).
- Errors: `400` malformed public ID · `401` missing/invalid session · `403` not admin · `404` product or variant does not exist, is soft-deleted, or the variant does not belong to the product · `500` unexpected error

**Example Request**

```bash
curl -H "Cookie: session=<SESSION_TOKEN>" \
  "https://api.example.com/api/v1/admin/products/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/variants/var_01K4X8Y9P4M4G8N6F9V2A1B3C"
```

---

### PATCH /api/v1/admin/products/{product_public_id}/variants/{variant_public_id}

**Overview:** Updates editable fields of a variant. Partial update — only provided fields change.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `PATCH` · URL: `/api/v1/admin/products/{product_public_id}/variants/{variant_public_id}`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: `product_public_id`, `variant_public_id` (string, required)
- Query params: None
- Request body: all fields optional; validation same as Create Variant. `barcode`, `color`, `size`, `cost_price`, `weight`, `length`, `width`, `height`, `status` accept `null` to clear.

**Response**

- Success: `200 OK` — enveloped updated Variant Object.
- Errors: `400` invalid body · `401` missing/invalid session · `403` not admin · `404` product or variant not found/soft-deleted/mismatched · `409` `VARIANT_SKU_TAKEN` · `500` unexpected error

**Example Request**

```bash
curl -X PATCH "https://api.example.com/api/v1/admin/products/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/variants/var_01K4X8Y9P4M4G8N6F9V2A1B3C" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -d '{"price":"119.99","discount_percentage":"15.00","status":"ACTIVE"}'
```

---

### DELETE /api/v1/admin/products/{product_public_id}/variants/{variant_public_id}

**Overview:** Soft-deletes a variant. The record is retained with a `deleted_at` timestamp and excluded from subsequent reads.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `DELETE` · URL: `/api/v1/admin/products/{product_public_id}/variants/{variant_public_id}`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: `product_public_id`, `variant_public_id` (string, required)
- Query params: None · Body: None

**Response**

- Success: `204 No Content` (empty body)
- Errors: `400` malformed public ID · `401` missing/invalid session · `403` not admin · `404` product or variant not found/soft-deleted/mismatched · `500` unexpected error

**Example Request**

```bash
curl -X DELETE -H "Cookie: session=<SESSION_TOKEN>" \
  "https://api.example.com/api/v1/admin/products/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/variants/var_01K4X8Y9P4M4G8N6F9V2A1B3C"
```

---

## 7. Product Images — Admin

Images are hard-deleted resources (no `deleted_at`). The API stores URLs only; binaries are uploaded to ImageKit via the signed flow.

**Product Image Object**

```json
{
  "public_id": "pimg_01K4...",
  "product_public_id": "prd_01K4...",
  "image_url": "https://cdn.example.com/.../hero.jpg",
  "alt_text": "Wireless headphones in black",
  "display_order": 1,
  "is_primary": true,
  "created_at": "2026-08-01T11:00:00Z",
  "updated_at": "2026-08-01T11:00:00Z"
}
```

### GET /api/v1/admin/products/{product_public_id}/images

**Overview:** Returns the images of a product ordered by `display_order` ascending.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `GET` · URL: `/api/v1/admin/products/{product_public_id}/images`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: `product_public_id` (string, required, `prd_...`)
- Query params: `page` (integer, no, default `1`) · `limit` (integer, no, default `20`, max `100`)
- Body: None

**Response**

- Success: `200 OK` — enveloped list of Product Image Objects with pagination.
- Errors: `400` invalid query parameter · `401` missing/invalid session · `403` not admin · `404` parent product not found or soft-deleted · `500` unexpected error

**Example Request**

```bash
curl -H "Cookie: session=<SESSION_TOKEN>" \
  "https://api.example.com/api/v1/admin/products/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/images?page=1&limit=20"
```

---

### POST /api/v1/admin/products/{product_public_id}/images

**Overview:** Adds an image to a product's gallery.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `POST` · URL: `/api/v1/admin/products/{product_public_id}/images`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: `product_public_id` (string, required, `prd_...`)
- Query params: None
- Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `image_url` | string | Yes | Absolute `http`/`https` URL, max 2048 chars |
| `alt_text` | string | No | Max 255 characters |
| `display_order` | integer | No | ≥ 0, unique within the product. Default: current max + 1 |
| `is_primary` | boolean | No | Default `false` (the first image added to a product automatically becomes primary) |

**Response**

- Success: `201 Created` — enveloped Product Image Object.
- Errors: `400` invalid body · `401` missing/invalid session · `403` not admin · `404` parent product not found or soft-deleted · `409` `DISPLAY_ORDER_CONFLICT` (display order already in use within the product) · `500` unexpected error

**Example Request**

```bash
curl -X POST "https://api.example.com/api/v1/admin/products/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/images" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -d '{"image_url":"https://cdn.example.com/prd_.../hero.jpg","alt_text":"Wireless headphones in black","display_order":1,"is_primary":true}'
```

---

### GET /api/v1/admin/products/{product_public_id}/images/{image_public_id}

**Overview:** Returns a single image of a product.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `GET` · URL: `/api/v1/admin/products/{product_public_id}/images/{image_public_id}`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: `product_public_id` (string, required, `prd_...`) · `image_public_id` (string, required, `pimg_...`)
- Query params: None · Body: None

**Response**

- Success: `200 OK` — enveloped Product Image Object.
- Errors: `400` malformed public ID · `401` missing/invalid session · `403` not admin · `404` product or image not found, product soft-deleted, or image does not belong to the product · `500` unexpected error

**Example Request**

```bash
curl -H "Cookie: session=<SESSION_TOKEN>" \
  "https://api.example.com/api/v1/admin/products/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/images/pimg_01K4X8Y9P4M4G8N6F9V2A1B3C"
```

---

### PATCH /api/v1/admin/products/{product_public_id}/images/{image_public_id}

**Overview:** Updates editable fields of a product image. Partial update — only provided fields change.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `PATCH` · URL: `/api/v1/admin/products/{product_public_id}/images/{image_public_id}`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: `product_public_id`, `image_public_id` (string, required)
- Query params: None
- Request body: all fields optional.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `image_url` | string | No | Absolute `http`/`https` URL, max 2048 chars |
| `alt_text` | string \| null | No | Max 255 chars; `null` clears |
| `display_order` | integer | No | ≥ 0, unique within the product |
| `is_primary` | boolean | No | `true` demotes the current primary image; clearing the flag on the product's only image is rejected |

**Response**

- Success: `200 OK` — enveloped updated Product Image Object.
- Errors: `400` invalid body, or clearing the primary flag on the only image · `401` missing/invalid session · `403` not admin · `404` product or image not found/soft-deleted/mismatched · `409` `DISPLAY_ORDER_CONFLICT` · `500` unexpected error

**Example Request**

```bash
curl -X PATCH "https://api.example.com/api/v1/admin/products/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/images/pimg_01K4X8Y9P4M4G8N6F9V2A1B3C" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -d '{"alt_text":"Wireless headphones in black, hero shot","is_primary":true}'
```

---

### DELETE /api/v1/admin/products/{product_public_id}/images/{image_public_id}

**Overview:** Permanently removes an image from a product's gallery (hard delete). If the primary image is deleted, the remaining image with the lowest `display_order` is promoted to primary.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `DELETE` · URL: `/api/v1/admin/products/{product_public_id}/images/{image_public_id}`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: `product_public_id`, `image_public_id` (string, required)
- Query params: None · Body: None

**Response**

- Success: `204 No Content` (empty body)
- Errors: `400` malformed public ID · `401` missing/invalid session · `403` not admin · `404` product or image not found/soft-deleted/mismatched · `500` unexpected error

**Example Request**

```bash
curl -X DELETE -H "Cookie: session=<SESSION_TOKEN>" \
  "https://api.example.com/api/v1/admin/products/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/images/pimg_01K4X8Y9P4M4G8N6F9V2A1B3C"
```

---

## 8. Product Variant Images — Admin

Variant image objects carry **no timestamps**. Membership is enforced at every level of the path (product → variant → image).

**Variant Image Object**

```json
{
  "public_id": "vimg_01K4...",
  "product_variant_public_id": "var_01K4...",
  "image_url": "https://cdn.example.com/.../black-side.jpg",
  "alt_text": "Wireless headphones in black, side view",
  "display_order": 1
}
```

### GET /api/v1/admin/products/{product_public_id}/variants/{variant_public_id}/images

**Overview:** Returns the images of a variant ordered by `display_order` ascending.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `GET` · URL: `/api/v1/admin/products/{product_public_id}/variants/{variant_public_id}/images`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: `product_public_id`, `variant_public_id` (string, required)
- Query params: `page` (integer, no, default `1`) · `limit` (integer, no, default `20`, max `100`)
- Body: None

**Response**

- Success: `200 OK` — enveloped list of Variant Image Objects with pagination.
- Errors: `400` invalid query parameter · `401` missing/invalid session · `403` not admin · `404` product or variant not found/soft-deleted/mismatched · `500` unexpected error

**Example Request**

```bash
curl -H "Cookie: session=<SESSION_TOKEN>" \
  "https://api.example.com/api/v1/admin/products/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/variants/var_01K4X8Y9P4M4G8N6F9V2A1B3C/images?page=1&limit=20"
```

---

### POST /api/v1/admin/products/{product_public_id}/variants/{variant_public_id}/images

**Overview:** Adds an image to a variant's gallery.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `POST` · URL: `/api/v1/admin/products/{product_public_id}/variants/{variant_public_id}/images`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: `product_public_id`, `variant_public_id` (string, required)
- Query params: None
- Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `image_url` | string | Yes | Absolute `http`/`https` URL, max 2048 chars |
| `alt_text` | string | No | Max 255 characters |
| `display_order` | integer | No | ≥ 0, unique within the variant. Default: current max + 1 |

**Response**

- Success: `201 Created` — enveloped Variant Image Object.
- Errors: `400` invalid body · `401` missing/invalid session · `403` not admin · `404` product or variant not found/soft-deleted/mismatched · `409` `DISPLAY_ORDER_CONFLICT` · `500` unexpected error

**Example Request**

```bash
curl -X POST "https://api.example.com/api/v1/admin/products/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/variants/var_01K4X8Y9P4M4G8N6F9V2A1B3C/images" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -d '{"image_url":"https://cdn.example.com/.../black-side.jpg","alt_text":"Wireless headphones in black, side view","display_order":1}'
```

---

### GET /api/v1/admin/products/{product_public_id}/variants/{variant_public_id}/images/{variant_image_public_id}

**Overview:** Returns a single image of a variant.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `GET` · URL: `/api/v1/admin/products/{product_public_id}/variants/{variant_public_id}/images/{variant_image_public_id}`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: `product_public_id`, `variant_public_id`, `variant_image_public_id` (string, required, `vimg_...`)
- Query params: None · Body: None

**Response**

- Success: `200 OK` — enveloped Variant Image Object.
- Errors: `400` malformed public ID · `401` missing/invalid session · `403` not admin · `404` product, variant, or image not found, a parent is soft-deleted, or the image does not belong to the variant · `500` unexpected error

**Example Request**

```bash
curl -H "Cookie: session=<SESSION_TOKEN>" \
  "https://api.example.com/api/v1/admin/products/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/variants/var_01K4X8Y9P4M4G8N6F9V2A1B3C/images/vimg_01K4X8Y9P4M4G8N6F9V2A1B3C"
```

---

### PATCH /api/v1/admin/products/{product_public_id}/variants/{variant_public_id}/images/{variant_image_public_id}

**Overview:** Updates editable fields of a variant image. Partial update — only provided fields change.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `PATCH` · URL: `/api/v1/admin/products/{product_public_id}/variants/{variant_public_id}/images/{variant_image_public_id}`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: `product_public_id`, `variant_public_id`, `variant_image_public_id` (string, required)
- Query params: None
- Request body: all fields optional; `alt_text` accepts `null` to clear.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `image_url` | string | No | Absolute `http`/`https` URL, max 2048 chars |
| `alt_text` | string \| null | No | Max 255 chars; `null` clears |
| `display_order` | integer | No | ≥ 0, unique within the variant |

**Response**

- Success: `200 OK` — enveloped updated Variant Image Object.
- Errors: `400` invalid body · `401` missing/invalid session · `403` not admin · `404` not found/soft-deleted/mismatched · `409` `DISPLAY_ORDER_CONFLICT` · `500` unexpected error

**Example Request**

```bash
curl -X PATCH "https://api.example.com/api/v1/admin/products/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/variants/var_01K4X8Y9P4M4G8N6F9V2A1B3C/images/vimg_01K4X8Y9P4M4G8N6F9V2A1B3C" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -d '{"alt_text":"Wireless headphones in black, side view (v2)","display_order":2}'
```

---

### DELETE /api/v1/admin/products/{product_public_id}/variants/{variant_public_id}/images/{variant_image_public_id}

**Overview:** Permanently removes an image from a variant's gallery (hard delete).

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `DELETE` · URL: `/api/v1/admin/products/{product_public_id}/variants/{variant_public_id}/images/{variant_image_public_id}`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: `product_public_id`, `variant_public_id`, `variant_image_public_id` (string, required)
- Query params: None · Body: None

**Response**

- Success: `204 No Content` (empty body)
- Errors: `400` malformed public ID · `401` missing/invalid session · `403` not admin · `404` not found/soft-deleted/mismatched · `500` unexpected error

**Example Request**

```bash
curl -X DELETE -H "Cookie: session=<SESSION_TOKEN>" \
  "https://api.example.com/api/v1/admin/products/prd_01K4X8Y9P4M4G8N6F9V2A1B3C/variants/var_01K4X8Y9P4M4G8N6F9V2A1B3C/images/vimg_01K4X8Y9P4M4G8N6F9V2A1B3C"
```

---

## 9. Categories — Public

Categories carry an explicit `is_active` flag; customer visibility = `is_active = true` AND `deleted_at IS NULL`.

### GET /api/v1/categories

**Overview:** Returns a paginated list of customer-visible (active and non-deleted) categories.

**Authentication:** None

**Request**

- Method: `GET` · URL: `/api/v1/categories`
- Headers: None · Body: None
- Query params:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `page` | integer | No | Page number, 1-based (default `1`) |
| `limit` | integer | No | Page size (default `20`, max `100`) |
| `search` | string | No | Case-insensitive substring match against `name` and `slug` |
| `sort` | string | No | Allowed: `name`, `created_at`, `updated_at`; `-` prefix for descending. Default `name` (ascending) |

**Response**

- Success: `200 OK` — enveloped list of Customer Category Objects with pagination. `is_active` and `deleted_at` are omitted.

  ```json
  {
    "success": true,
    "data": [
      {
        "public_id": "cat_01K4...",
        "name": "Headphones",
        "slug": "headphones",
        "description": "Wired and wireless headphones, earbuds, and headsets.",
        "created_at": "2026-08-01T10:00:00Z",
        "updated_at": "2026-08-01T10:00:00Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1, "hasNext": false, "hasPrev": false }
  }
  ```

- Errors: `400` invalid `page`/`limit`/`sort` · `500` unexpected error

**Example Request**

```bash
curl "https://api.example.com/api/v1/categories?page=1&limit=20&search=headphones&sort=name"
```

---

### GET /api/v1/categories/{category_public_id}

**Overview:** Returns a single customer-visible category with the count of its customer-visible products.

**Authentication:** None

**Request**

- Method: `GET` · URL: `/api/v1/categories/{category_public_id}`
- Path params: `category_public_id` (string, required, `cat_...`)
- Query params: None · Headers: None · Body: None

**Response**

- Success: `200 OK` — enveloped Customer Category Object plus `product_count` (number, required; counts customer-visible linked products).

  ```json
  {
    "success": true,
    "data": {
      "public_id": "cat_01K4...",
      "name": "Headphones",
      "slug": "headphones",
      "description": "Wired and wireless headphones, earbuds, and headsets.",
      "created_at": "2026-08-01T10:00:00Z",
      "updated_at": "2026-08-02T09:00:00Z",
      "product_count": 12
    }
  }
  ```

- Errors: `400` malformed public ID · `404` category does not exist, is inactive, or is soft-deleted (single response to avoid leaking existence) · `500` unexpected error

**Example Request**

```bash
curl "https://api.example.com/api/v1/categories/cat_01K4X8Y9P4M4G8N6F9V2A1B3C"
```

---

### GET /api/v1/categories/{category_public_id}/products

**Overview:** Returns a paginated list of customer-visible products belonging to a category.

**Authentication:** None

**Request**

- Method: `GET` · URL: `/api/v1/categories/{category_public_id}/products`
- Path params: `category_public_id` (string, required, `cat_...`)
- Query params:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `page` | integer | No | Page number, 1-based (default `1`) |
| `limit` | integer | No | Page size (default `20`, max `100`) |
| `search` | string | No | Case-insensitive substring match against `name`, `brand`, `description` |
| `sort` | string | No | Allowed: `name`, `created_at`, `updated_at`. Default `-created_at` |

- Headers: None · Body: None

**Response**

- Success: `200 OK` — enveloped list of Product Objects with pagination. Only customer-visible products are returned.
- Errors: `400` malformed public ID or invalid query parameter · `404` category does not exist, is inactive, or is soft-deleted · `500` unexpected error

**Example Request**

```bash
curl "https://api.example.com/api/v1/categories/cat_01K4X8Y9P4M4G8N6F9V2A1B3C/products?page=1&limit=20&search=wireless"
```

---

## 10. Categories — Admin

### GET /api/v1/admin/categories

**Overview:** Returns a paginated list of all categories, including inactive and optionally soft-deleted ones.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `GET` · URL: `/api/v1/admin/categories`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Body: None
- Query params:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `page` | integer | No | Page number, 1-based (default `1`) |
| `limit` | integer | No | Page size (default `20`, max `100`) |
| `search` | string | No | Case-insensitive substring match against `name` and `slug` |
| `is_active` | boolean | No | Filter by activation state. Omitted: all states |
| `include_deleted` | boolean | No | Include soft-deleted categories (default `false`) |
| `sort` | string | No | Allowed: `name`, `created_at`, `updated_at`. Default `name` (ascending) |

**Response**

- Success: `200 OK` — enveloped list of Admin Category Objects (incl. `is_active`) with pagination. `deleted_at` is never exposed.

  ```json
  {
    "success": true,
    "data": [
      {
        "public_id": "cat_01K4...",
        "name": "Headphones",
        "slug": "headphones",
        "description": "Wired and wireless headphones, earbuds, and headsets.",
        "is_active": true,
        "created_at": "2026-08-01T10:00:00Z",
        "updated_at": "2026-08-01T10:00:00Z"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 3, "totalPages": 1, "hasNext": false, "hasPrev": false }
  }
  ```

- Errors: `400` invalid query parameter · `401` missing/invalid session · `403` not admin · `500` unexpected error

**Example Request**

```bash
curl -H "Cookie: session=<SESSION_TOKEN>" \
  "https://api.example.com/api/v1/admin/categories?include_deleted=true&is_active=true&page=1&limit=20"
```

---

### POST /api/v1/admin/categories

**Overview:** Creates a new category.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `POST` · URL: `/api/v1/admin/categories`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Query params: None
- Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `slug` | string | No | 1–255 chars, matches slug regex; auto-generated from `name` when omitted |
| `name` | string | Yes | 1–255 chars, unique |
| `description` | string | No | Max 10000 characters |
| `is_active` | boolean | No | Default `true` |

**Response**

- Success: `201 Created` — enveloped Admin Category Object.
- Errors: `400` invalid body or malformed slug · `401` missing/invalid session · `403` not admin · `409` `CATEGORY_SLUG_TAKEN` or `CATEGORY_NAME_TAKEN` · `500` unexpected error

**Example Request**

```bash
curl -X POST "https://api.example.com/api/v1/admin/categories" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -d '{"name":"Headphones","description":"Wired and wireless headphones, earbuds, and headsets.","is_active":true}'
```

---

### GET /api/v1/admin/categories/{category_public_id}

**Overview:** Returns a single category with the count of its non-deleted linked products.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `GET` · URL: `/api/v1/admin/categories/{category_public_id}`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: `category_public_id` (string, required, `cat_...`)
- Query params: None · Body: None

**Response**

- Success: `200 OK` — enveloped Admin Category Object plus `product_count` (number, required; counts linked products with `deleted_at IS NULL`).
- Errors: `400` malformed public ID · `401` missing/invalid session · `403` not admin · `404` category does not exist or is soft-deleted · `500` unexpected error

**Example Request**

```bash
curl -H "Cookie: session=<SESSION_TOKEN>" \
  "https://api.example.com/api/v1/admin/categories/cat_01K4X8Y9P4M4G8N6F9V2A1B3C"
```

---

### PATCH /api/v1/admin/categories/{category_public_id}

**Overview:** Updates editable fields of a category. Partial update — only provided fields change.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `PATCH` · URL: `/api/v1/admin/categories/{category_public_id}`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: `category_public_id` (string, required, `cat_...`)
- Query params: None
- Request body: all fields optional; `description` accepts `null` to clear.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `slug` | string | No | 1–255 chars, matches slug regex |
| `name` | string | No | 1–255 characters |
| `description` | string \| null | No | Max 10000 chars; `null` clears |
| `is_active` | boolean | No | Toggles customer visibility |

**Response**

- Success: `200 OK` — enveloped updated Admin Category Object.
- Errors: `400` invalid body · `401` missing/invalid session · `403` not admin · `404` category not found or soft-deleted · `409` `CATEGORY_NAME_TAKEN` or `CATEGORY_SLUG_TAKEN` · `500` unexpected error

**Example Request**

```bash
curl -X PATCH "https://api.example.com/api/v1/admin/categories/cat_01K4X8Y9P4M4G8N6F9V2A1B3C" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -d '{"name":"Headphones & Earbuds","is_active":true}'
```

---

### DELETE /api/v1/admin/categories/{category_public_id}

**Overview:** Soft-deletes a category and, in the same transaction, hard-removes all of its product-to-category assignment links.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `DELETE` · URL: `/api/v1/admin/categories/{category_public_id}`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: `category_public_id` (string, required, `cat_...`)
- Query params: None · Body: None

**Response**

- Success: `204 No Content` (empty body)
- Errors: `400` malformed public ID · `401` missing/invalid session · `403` not admin · `404` category not found or already soft-deleted · `500` unexpected error

**Example Request**

```bash
curl -X DELETE -H "Cookie: session=<SESSION_TOKEN>" \
  "https://api.example.com/api/v1/admin/categories/cat_01K4X8Y9P4M4G8N6F9V2A1B3C"
```

---

### PUT /api/v1/admin/categories/{category_public_id}/products/{product_public_id}

**Overview:** Assigns a product to a category by creating a `product_categories` link. Idempotent: assigning an already-assigned product is a no-op.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `PUT` · URL: `/api/v1/admin/categories/{category_public_id}/products/{product_public_id}`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: `category_public_id` (string, required, `cat_...`) · `product_public_id` (string, required, `prd_...`)
- Query params: None · Body: None

**Response**

- Success: `204 No Content` (empty body)
- Errors: `400` malformed public ID · `401` missing/invalid session · `403` not admin · `404` `CATEGORY_NOT_FOUND` or `PRODUCT_NOT_FOUND` · `500` unexpected error

**Example Request**

```bash
curl -X PUT -H "Cookie: session=<SESSION_TOKEN>" \
  "https://api.example.com/api/v1/admin/categories/cat_01K4X8Y9P4M4G8N6F9V2A1B3C/products/prd_01K4X8Y9P4M4G8N6F9V2A1B3C"
```

---

### DELETE /api/v1/admin/categories/{category_public_id}/products/{product_public_id}

**Overview:** Removes a product from a category by deleting the `product_categories` link. Idempotent: removing a link that does not exist is a no-op.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `DELETE` · URL: `/api/v1/admin/categories/{category_public_id}/products/{product_public_id}`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: `category_public_id` (string, required, `cat_...`) · `product_public_id` (string, required, `prd_...`)
- Query params: None · Body: None

**Response**

- Success: `204 No Content` (empty body)
- Errors: `400` malformed public ID · `401` missing/invalid session · `403` not admin · `404` `CATEGORY_NOT_FOUND` or `PRODUCT_NOT_FOUND` · `500` unexpected error

**Example Request**

```bash
curl -X DELETE -H "Cookie: session=<SESSION_TOKEN>" \
  "https://api.example.com/api/v1/admin/categories/cat_01K4X8Y9P4M4G8N6F9V2A1B3C/products/prd_01K4X8Y9P4M4G8N6F9V2A1B3C"
```

---

## 11. Inventory — Admin

**Inventory Object**

```json
{
  "public_id": "var_01K4...",
  "product_public_id": "prd_01K4...",
  "product_name": "Wireless Noise-Cancelling Headphones",
  "sku": "SW-HP-001-BLK-M",
  "barcode": "4006381333931",
  "quantity_on_hand": 100,
  "quantity_reserved": 5,
  "quantity_available": 95,
  "reorder_level": 20,
  "stock_status": "IN_STOCK",
  "created_at": "2026-08-01T10:00:00Z",
  "last_stock_update": "2026-08-02T09:00:00Z"
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `public_id` | string | Yes | Public ID of the owning variant (`var_...`) — the stable key of the inventory record |
| `product_public_id` | string | Yes | Public ID of the parent product |
| `product_name` | string | Yes | Name of the parent product |
| `sku` | string | Yes | Variant SKU |
| `barcode` | string | No | Variant barcode, when set |
| `quantity_on_hand` | integer | Yes | Total quantity in stock (≥ 0) |
| `quantity_reserved` | integer | Yes | Reserved for pending orders |
| `quantity_available` | integer | Yes | Derived: `quantity_on_hand - quantity_reserved` |
| `reorder_level` | integer | No | Replenishment threshold |
| `stock_status` | string | Yes | `IN_STOCK`, `LOW_STOCK`, or `OUT_OF_STOCK` |
| `created_at` | string | Yes | Creation timestamp |
| `last_stock_update` | string | Yes | Most recent stock update timestamp |

`stock_status` derivation: `OUT_OF_STOCK` when `quantity_available <= 0`; `LOW_STOCK` when `reorder_level IS NOT NULL AND quantity_available <= reorder_level`; otherwise `IN_STOCK`.

### GET /api/v1/admin/inventory

**Overview:** Returns a paginated list of inventory records for product variants, with search, stock-status filtering, and sorting. Intended for the admin inventory dashboard.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `GET` · URL: `/api/v1/admin/inventory`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Body: None
- Query params:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `page` | integer | No | Page number, 1-based (default `1`) |
| `limit` | integer | No | Page size (default `20`, max `100`) |
| `search` | string | No | Case-insensitive substring match against variant `sku`, `barcode`, or product `name` |
| `stock_status` | string | No | Filter by `IN_STOCK`, `LOW_STOCK`, or `OUT_OF_STOCK` |
| `include_deleted` | boolean | No | Include inventory of soft-deleted variants (default `false`) |
| `sort` | string | No | Allowed: `product_name`, `sku`, `quantity_on_hand`, `quantity_available`, `last_stock_update`. Default `product_name` (ascending) |

**Response**

- Success: `200 OK` — `{ "success": true, "data": [ InventoryObject ], "pagination": { ... } }`.
- Errors: `400` invalid query parameters (e.g. "Invalid sort field") · `401` missing/invalid session · `403` not admin · `500` unexpected error

**Example Request**

```bash
curl -X GET "https://api.example.com/api/v1/admin/inventory?page=1&limit=20&search=wireless&stock_status=LOW_STOCK&include_deleted=false&sort=-last_stock_update" \
  -H "Cookie: session=<SESSION_TOKEN>"
```

---

### POST /api/v1/admin/inventory

**Overview:** Creates the inventory record for a product variant with an initial on-hand quantity. Inventory is not created automatically by the Product Catalog API; an admin creates it explicitly.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `POST` · URL: `/api/v1/admin/inventory`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Query params: None
- Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `variant_public_id` | string | Yes | Public ID of an existing non-deleted variant (`var_...`) |
| `quantity_on_hand` | integer | Yes | Initial stock quantity, ≥ 0 |
| `reorder_level` | integer | No | Replenishment threshold, ≥ 0 |

**Response**

- Success: `201 Created` — `{ "success": true, "data": InventoryObject }` (`quantity_reserved` returned as `0`; `last_stock_update` equals `created_at` on creation).
- Errors: `400` invalid body (e.g. negative quantity) · `401` missing/invalid session · `403` not admin · `404` variant does not exist or is soft-deleted · `409` inventory record already exists for the variant · `500` unexpected error

**Example Request**

```bash
curl -X POST "https://api.example.com/api/v1/admin/inventory" \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"variant_public_id":"var_01K4...","quantity_on_hand":100,"reorder_level":20}'
```

---

### GET /api/v1/admin/inventory/{variant_public_id}

**Overview:** Returns the inventory record for a single product variant, keyed by the variant's public ID.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `GET` · URL: `/api/v1/admin/inventory/{variant_public_id}`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: `variant_public_id` (string, required, `var_...`)
- Query params: None · Body: None

**Response**

- Success: `200 OK` — `{ "success": true, "data": InventoryObject }`.
- Errors: `400` malformed `variant_public_id` · `401` missing/invalid session · `403` not admin · `404` variant does not exist, is soft-deleted, or has no inventory record · `500` unexpected error

**Example Request**

```bash
curl -X GET "https://api.example.com/api/v1/admin/inventory/var_01K4..." \
  -H "Cookie: session=<SESSION_TOKEN>"
```

---

### PATCH /api/v1/admin/inventory/{variant_public_id}

**Overview:** Adjusts the stock of a product variant: sets the absolute on-hand quantity, applies a signed delta (increase/decrease), and/or updates the reorder level. All quantity changes are applied atomically in a transaction with a row-level lock; a change that would drive stock below zero is rejected (overselling guard).

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `PATCH` · URL: `/api/v1/admin/inventory/{variant_public_id}`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: `variant_public_id` (string, required, `var_...`)
- Query params: None
- Request body: at least one field required; `quantity_on_hand` and `quantity_change` are mutually exclusive.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `quantity_on_hand` | integer | No | Absolute stock quantity, ≥ 0. Mutually exclusive with `quantity_change` |
| `quantity_change` | integer | No | Signed delta (positive = increase, negative = decrease). Non-zero. Mutually exclusive with `quantity_on_hand` |
| `reorder_level` | integer \| null | No | Replenishment threshold, ≥ 0; `null` clears |
| `reason` | string | No | Free-text reason (max 255 chars). Audit-only; never persisted |

**Response**

- Success: `200 OK` — `{ "success": true, "data": InventoryObject }` with updated `quantity_on_hand`, derived `quantity_available`/`stock_status`, and refreshed `last_stock_update`.
- Errors: `400` empty body ("At least one field is required"), negative quantity, `quantity_change: 0` ("Quantity change must be non-zero"), both fields provided, `reason` > 255 chars · `401` missing/invalid session · `403` not admin · `404` variant not found/soft-deleted/no record · `409` change would drive stock below zero · `500` unexpected error

**Example Request**

```bash
curl -X PATCH "https://api.example.com/api/v1/admin/inventory/var_01K4..." \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"quantity_change":-15,"reason":"Damaged units written off after stocktake"}'
```

---

## 12. Cart

Cart lines are keyed by the **variant's public ID** (`var_...`). The cart is always scoped to the authenticated user.

**Cart Object**

```json
{
  "public_id": "crt_01K4...",
  "items_count": 2,
  "total_quantity": 5,
  "subtotal": "390.95",
  "items": [
    {
      "variant_public_id": "var_01K4...",
      "product_public_id": "prd_01K4...",
      "product_name": "Wireless Noise-Cancelling Headphones",
      "product_slug": "wireless-noise-cancelling-headphones",
      "sku": "SW-HP-001-BLK-M",
      "color": "Black",
      "size": "M",
      "image_url": "https://cdn.example.com/.../black-side.jpg",
      "price": "129.99",
      "discount_percentage": "10.00",
      "final_price": "116.99",
      "quantity": 3,
      "line_total": "350.97",
      "created_at": "2026-08-01T10:00:00Z",
      "updated_at": "2026-08-02T14:30:00Z"
    }
  ],
  "created_at": "2026-08-01T10:00:00Z",
  "updated_at": "2026-08-02T14:30:00Z"
}
```

Derived fields: `final_price = price * (1 - discount_percentage / 100)` (or `price` when no discount); `line_total = round2(final_price * quantity)`; `subtotal = sum(line_total)`; `items_count` = distinct variants; `total_quantity` = sum of quantities.

### GET /api/v1/cart

**Overview:** Returns the authenticated user's cart with all line items and computed totals.

**Authentication:** Session required

**Request**

- Method: `GET` · URL: `/api/v1/cart`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Query params: None · Body: None

**Response**

- Success: `200 OK` — `{ "success": true, "data": CartObject }` (no pagination — full item list).
- Errors: `401` missing/invalid session · `404` user has no cart yet ("Cart not found for this user") · `500` unexpected error

**Example Request**

```bash
curl -X GET "https://api.example.com/api/v1/cart" -H "Cookie: session=<SESSION_TOKEN>"
```

---

### POST /api/v1/cart/items

**Overview:** Adds a product variant to the authenticated user's cart. If the user has no cart, one is created in the same transaction. If the variant is already in the cart, the existing line's quantity is incremented (merge-on-add) instead of creating a duplicate line.

**Authentication:** Session required

**Request**

- Method: `POST` · URL: `/api/v1/cart/items`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Query params: None
- Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `variant_public_id` | string | Yes | Public ID of a purchasable variant (`var_...`) |
| `quantity` | integer | No | Quantity to add, ≥ 1 and ≤ 999. Default `1` |

**Response**

- Success: `200 OK` (merge semantics — not 201) — `{ "success": true, "data": CartObject }` reflecting the resulting cart state.
- Errors: `400` invalid body (e.g. `quantity < 1` or `> 999`, merged quantity would exceed 999) · `401` missing/invalid session · `404` variant does not exist, is soft-deleted, or is not `ACTIVE` · `500` unexpected error

**Example Request**

```bash
curl -X POST "https://api.example.com/api/v1/cart/items" \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"variant_public_id":"var_01K4...","quantity":2}'
```

---

### PATCH /api/v1/cart/items/{variant_public_id}

**Overview:** Sets the absolute quantity of a cart line (idempotent set — sending the current value is a no-op success). Intended for quantity steppers on the cart page.

**Authentication:** Session required

**Request**

- Method: `PATCH` · URL: `/api/v1/cart/items/{variant_public_id}`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: `variant_public_id` (string, required, `var_...`)
- Query params: None
- Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `quantity` | integer | Yes | New quantity, ≥ 1 and ≤ 999. Absolute set (not a delta) |

**Response**

- Success: `200 OK` — `{ "success": true, "data": CartObject }` with updated line quantity.
- Errors: `400` invalid body (`quantity < 1` or `> 999`, missing) · `401` missing/invalid session · `404` user has no cart, or the variant is not in the cart · `500` unexpected error

**Example Request**

```bash
curl -X PATCH "https://api.example.com/api/v1/cart/items/var_01K4..." \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"quantity":4}'
```

---

### DELETE /api/v1/cart/items/{variant_public_id}

**Overview:** Removes a single line from the authenticated user's cart. The line row is hard-deleted; the cart row (and its remaining lines) are preserved.

**Authentication:** Session required

**Request**

- Method: `DELETE` · URL: `/api/v1/cart/items/{variant_public_id}`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: `variant_public_id` (string, required, `var_...`)
- Query params: None · Body: None

**Response**

- Success: `204 No Content` (empty body). The cart row is preserved even when this was the last line.
- Errors: `400` malformed `variant_public_id` · `401` missing/invalid session · `404` user has no cart, or the variant is not in the cart · `500` unexpected error

**Example Request**

```bash
curl -X DELETE "https://api.example.com/api/v1/cart/items/var_01K4..." \
  -H "Cookie: session=<SESSION_TOKEN>"
```

---

### DELETE /api/v1/cart

**Overview:** Empties the authenticated user's cart. All line items are hard-deleted and the cart row itself is deleted in a single transaction. Afterward the user has no cart until the next add.

**Authentication:** Session required

**Request**

- Method: `DELETE` · URL: `/api/v1/cart`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Query params: None · Body: None

**Response**

- Success: `204 No Content` (empty body)
- Errors: `401` missing/invalid session · `404` user has no cart (nothing to clear) · `500` unexpected error

**Example Request**

```bash
curl -X DELETE "https://api.example.com/api/v1/cart" -H "Cookie: session=<SESSION_TOKEN>"
```

---

## 13. Orders — Customer

**Order Object (customer projection)**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `public_id` | string | Yes | Public order identifier (`ord_...`) |
| `order_number` | string | Yes | Human-readable number (`ORD-` + zero-padded internal ID) |
| `status` | string | Yes | `pending`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled`, `returned`, `refunded` |
| `placed_at` | string | Yes | Order placed timestamp (ISO 8601 UTC) |
| `subtotal` | string | Yes | Sum of all item `total_amount` |
| `discount_amount` | string | Yes | Order-level discount (`"0.00"` without coupon) |
| `shipping_fee` | string | Yes | Computed shipping fee |
| `tax_amount` | string | Yes | `"0.00"` in v1 |
| `total_amount` | string | Yes | `subtotal - discount_amount + shipping_fee + tax_amount` |
| `notes` | string | No | Customer notes |
| `shipping_address` | object | Yes | Immutable snapshot |
| `payment` | object | No | Present once a payment attempt exists |
| `items` | array | Yes | Order Item Objects |
| `created_at` | string | Yes | ISO 8601 UTC |
| `updated_at` | string | Yes | ISO 8601 UTC |

### POST /api/v1/orders

**Overview:** Checkout — consumes the session user's cart and creates an order with immutable item/address/payment snapshots, reserves and commits stock, and records payment, all in one transaction. The mock provider succeeds synchronously, so the order is returned in the `confirmed` state with stock committed and the cart cleared.

**Authentication:** Session required

**Request**

- Method: `POST` · URL: `/api/v1/orders`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Query params: None
- Request body (order items come from the session user's cart server-side — there is no items payload):

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `address_public_id` | string | Yes | Public ID of a saved address (`adr_...`) owned by the session user; must exist and not be soft-deleted |
| `payment_method` | string | Yes | Payment method; v1 supports only `mock` |
| `coupon_code` | string | No | Coupon code to apply (validated: active, in window, usage limits, minimum order amount) |
| `notes` | string | No | Free-form customer notes, max 1000 characters |

**Response**

- Success: `201 Created` — `{ "success": true, "data": Order Object (customer projection) }`. The order is returned in the `confirmed` state.
- Errors:

| Status | Condition |
| --- | --- |
| 400 | Invalid request body (e.g. unsupported `payment_method`, malformed `address_public_id`) |
| 401 | Missing or invalid session |
| 404 | No cart ("Cart not found for this user"); `address_public_id` does not exist / soft-deleted / belongs to another user |
| 409 | Empty cart; a line is no longer purchasable (variant deleted/inactive or product deleted); insufficient stock; coupon invalid or not applicable |
| 500 | Unexpected server error |

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -d '{
    "address_public_id": "adr_01K4X8Y9P4M4G8N6F9V2A1B3C",
    "payment_method": "mock",
    "coupon_code": "WELCOME10",
    "notes": "Please leave at the front desk."
  }'
```

---

### GET /api/v1/orders

**Overview:** Returns the session user's order history, newest first, with pagination and an optional status filter ("My Orders" page).

**Authentication:** Session required

**Request**

- Method: `GET` · URL: `/api/v1/orders`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Body: None
- Query params:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `page` | integer | No | Page number, 1-based (default `1`) |
| `limit` | integer | No | Page size (default `20`, max `100`) |
| `status` | string | No | Filter by order status (e.g. `confirmed`, `shipped`, `delivered`, `cancelled`) |
| `sort` | string | No | Allowed: `placed_at`, `order_number`, `total_amount`. Default `-placed_at` |

**Response**

- Success: `200 OK` — `{ "success": true, "data": [ Order Object ], "pagination": { page, limit, total, totalPages, hasNext, hasPrev } }`. Empty history returns `data: []` and `total: 0`.
- Errors: `400` invalid query parameters · `401` missing/invalid session · `500` unexpected error

**Example Request**

```bash
curl "https://api.example.com/api/v1/orders?page=1&limit=20&status=confirmed&sort=-placed_at" \
  -H "Cookie: session=<SESSION_TOKEN>"
```

---

### GET /api/v1/orders/{order_public_id}

**Overview:** Returns a single order by public ID with all items, the shipping-address snapshot, and the payment record (order detail / confirmation page).

**Authentication:** Session required

**Request**

- Method: `GET` · URL: `/api/v1/orders/{order_public_id}`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: `order_public_id` (string, required, `ord_...`)
- Query params: None · Body: None

**Response**

- Success: `200 OK` — `{ "success": true, "data": Order Object (customer projection) }`.
- Errors: `400` invalid `order_public_id` format · `401` missing/invalid session · `404` order does not exist or does not belong to the session user (no existence leak) · `500` unexpected error

**Example Request**

```bash
curl "https://api.example.com/api/v1/orders/ord_01J6XK8Q3M2N5B7V9C4D1E0F" \
  -H "Cookie: session=<SESSION_TOKEN>"
```

---

## 14. Orders — Admin

Admin order detail/update responses use the Order Object extended with: `customer_public_id`, `customer_name`, `customer_email`, `customer_phone_number`, and `shipment` (`public_id`, `status`, `carrier`, `tracking_number`, `shipped_at`, `delivered_at`).

### GET /api/v1/admin/orders

**Overview:** Returns a paginated list of every order in the system with search, status, and date-range filters, plus sorting (admin order dashboard). Not scoped to any user.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `GET` · URL: `/api/v1/admin/orders`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Body: None
- Query params:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `page` | integer | No | Page number, 1-based (default `1`) |
| `limit` | integer | No | Page size (default `20`, max `100`) |
| `status` | string | No | Filter by order status (e.g. `pending`, `confirmed`, `shipped`) |
| `search` | string | No | Case-insensitive substring match against `order_number`, customer name, or customer email |
| `placed_from` | string | No | Inclusive lower bound on `placed_at` (ISO 8601 UTC) |
| `placed_to` | string | No | Inclusive upper bound on `placed_at` (ISO 8601 UTC) |
| `sort` | string | No | Allowed: `placed_at`, `order_number`, `total_amount`, `customer_name`. Default `-placed_at` |

**Response**

- Success: `200 OK` — `{ "success": true, "data": [ Admin Order List Row ], "pagination": { ... } }`. List rows are lighter: no items/payment embedded. Empty result set returns `data: []` and `total: 0`.
- Errors: `400` invalid query parameters (e.g. `placed_from > placed_to`) · `401` missing/invalid session · `403` not admin · `500` unexpected error

**Example Request**

```bash
curl "https://api.example.com/api/v1/admin/orders?page=1&limit=20&status=confirmed&search=ahmed&sort=-placed_at" \
  -H "Cookie: session=<SESSION_TOKEN>"
```

---

### GET /api/v1/admin/orders/{order_public_id}

**Overview:** Returns a single order (any customer's) with the full administrator projection: Order Object extended with the customer summary and the shipment record.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `GET` · URL: `/api/v1/admin/orders/{order_public_id}`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: `order_public_id` (string, required, `ord_...`)
- Query params: None · Body: None

**Response**

- Success: `200 OK` — `{ "success": true, "data": Administrator Order Projection }` — includes `shipment` (always present; fulfillment fields null until the order ships) and the customer summary.
- Errors: `400` invalid `order_public_id` format · `401` missing/invalid session · `403` not admin · `404` order does not exist · `500` unexpected error

**Example Request**

```bash
curl "https://api.example.com/api/v1/admin/orders/ord_01J6XK8Q3M2N5B7V9C4D1E0F" \
  -H "Cookie: session=<SESSION_TOKEN>"
```

---

### PATCH /api/v1/admin/orders/{order_public_id}

**Overview:** Advances or terminates an order's lifecycle (confirm, process, ship, deliver, cancel, return, refund) enforcing the allowed-transition matrix with transactional side effects (shipment updates, `shipped_at`/`delivered_at`, payment refund, stock release).

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `PATCH` · URL: `/api/v1/admin/orders/{order_public_id}`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: `order_public_id` (string, required, `ord_...`)
- Query params: None
- Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | string | Yes | Target status; must be a legal transition from the current status |
| `carrier` | string | No | Carrier name; **required when transitioning to `shipped`**; max 100 chars |
| `tracking_number` | string | No | Carrier tracking number; accepted when transitioning to `shipped`; max 100 chars |

**Allowed transitions**

| From | To |
| --- | --- |
| `pending` | `confirmed`, `cancelled` |
| `confirmed` | `processing`, `cancelled` |
| `processing` | `shipped`, `cancelled` |
| `shipped` | `delivered` |
| `delivered` | `returned` |
| `returned` | `refunded` |
| `cancelled`, `refunded` | *(terminal)* |

**Response**

- Success: `200 OK` — `{ "success": true, "data": Administrator Order Projection }`.
- Errors: `400` invalid body (e.g. missing `carrier` when shipping, unknown status) · `401` missing/invalid session · `403` not admin · `404` order does not exist · `409` illegal transition, no-op transition, or state conflict · `500` unexpected error

**Example Request**

```bash
curl -X PATCH "https://api.example.com/api/v1/admin/orders/ord_01J6XK8Q3M2N5B7V9C4D1E0F" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -d '{"status":"shipped","carrier":"DHL","tracking_number":"JD014600003301234567"}'
```

---

## 15. Reviews — Public

**Review Object (customer projection)**

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `public_id` | string | Yes | Public review identifier (`rev_...`) |
| `rating` | integer | Yes | 1–5 |
| `title` | string | No | Max 255 |
| `comment` | string | No | Free text (max 5000 on input) |
| `customer_name` | string | Yes | `first_name last_name` |
| `product_public_id` | string | Yes | Public product ID (`prd_...`) |
| `product_name` | string | Yes | Live product name |
| `product_slug` | string | Yes | Live product slug |
| `images` | array | Yes | Review Image Objects, ordered by `display_order`, then `created_at` |
| `created_at` | string | Yes | ISO 8601 UTC |
| `updated_at` | string | Yes | ISO 8601 UTC |

Never exposes `is_approved` or `deleted_at`. Customer-visible reviews always have `is_approved = true`.

### GET /api/v1/products/{product_public_id}/reviews

**Overview:** Returns the approved, non-deleted reviews for a product (paginated) plus a rating summary computed over all visible reviews. Public — no session required.

**Authentication:** None

**Request**

- Method: `GET` · URL: `/api/v1/products/{product_public_id}/reviews`
- Path params: `product_public_id` (string, required, `prd_...`)
- Query params:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `page` | integer | No | Page number, 1-based (default `1`, min `1`) |
| `limit` | integer | No | Page size (default `10`, 1–100) |
| `rating` | integer | No | Exact rating filter, 1–5 |
| `sort` | string | No | `created_at` or `rating`; `-` prefix for descending. Default `-created_at` |

- Headers: None · Body: None

**Response**

- Success: `200 OK` — enveloped object with `summary`, `reviews`, and `pagination` (shape `{ page, limit, total, has_more }`).

  ```json
  {
    "success": true,
    "data": {
      "summary": { "average_rating": 4.5, "total_count": 12 },
      "reviews": [ { "public_id": "rev_01K4...", "rating": 5, "customer_name": "Jane Doe" } ],
      "pagination": { "page": 1, "limit": 10, "total": 12, "has_more": true }
    }
  }
  ```

  Empty result set: `reviews: []`, `summary.total_count: 0`, `summary.average_rating: null`.

- Errors: `400` invalid query parameters · `404` product not found or soft-deleted

**Example Request**

```bash
curl "https://api.example.com/api/v1/products/prd_01J6XK8Q3M2N5B7V9C4D1E0F/reviews?page=1&limit=10&rating=5&sort=-created_at"
```

---

### GET /api/v1/reviews/{review_public_id}

**Overview:** Returns a single approved, non-deleted review. Public — no session required. Intended for deep links and single-review embeds.

**Authentication:** None

**Request**

- Method: `GET` · URL: `/api/v1/reviews/{review_public_id}`
- Path params: `review_public_id` (string, required, `rev_...`)
- Query params: None · Headers: None · Body: None

**Response**

- Success: `200 OK` — `{ "success": true, "data": Review Object (customer projection) }`.
- Errors: `400` invalid `review_public_id` format · `404` review not found, unapproved, or deleted (indistinguishable from missing)

**Example Request**

```bash
curl "https://api.example.com/api/v1/reviews/rev_01J6XK8Q3M2N5B7V9C4D1E0F"
```

---

## 16. Reviews — Authenticated User

### POST /api/v1/reviews

**Overview:** Creates a review for a product on behalf of the authenticated user. One review per user per product. Reviews are auto-approved in v1 (`is_approved` defaults `true`).

**Authentication:** Session required

**Request**

- Method: `POST` · URL: `/api/v1/reviews`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Query params: None
- Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `product_public_id` | string | Yes | `prd_...` format |
| `rating` | integer | Yes | 1–5 |
| `title` | string | No | Max 255 |
| `comment` | string | No | Max 5000 |
| `images` | array | No | Max 5 items; each item: `image_url` (string, required, absolute http/https URL), `alt_text` (string, optional, max 255) |

**Response**

- Success: `201 Created` — `{ "success": true, "data": Review Object (customer projection) }` (images get `display_order` 1..n by array index).
- Errors: `400` invalid body (rating out of range, bad `image_url`, too many images, missing `product_public_id`) · `401` not authenticated · `404` product not found or soft-deleted · `409` user already reviewed this product; (if `REVIEWS_REQUIRE_PURCHASE` enabled) no qualifying purchase · `500` unexpected error

**Example Request**

```bash
curl -X POST https://api.example.com/api/v1/reviews \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -d '{
    "product_public_id": "prd_01J6XK8Q3M2N5B7V9C4D1E0F",
    "rating": 5,
    "title": "Excellent quality",
    "comment": "The fabric feels premium.",
    "images": [
      { "image_url": "https://ik.imagekit.io/ecommerceImages/review-1.jpg", "alt_text": "Shirt on hanger" }
    ]
  }'
```

---

### PATCH /api/v1/reviews/{review_public_id}

**Overview:** Updates the authenticated user's own review. Partial update — only provided fields change; explicit `null` clears `title`/`comment`.

**Authentication:** Session required

**Request**

- Method: `PATCH` · URL: `/api/v1/reviews/{review_public_id}`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: `review_public_id` (string, required, `rev_...`)
- Query params: None
- Request body: at least one field required (empty body → 400).

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `rating` | integer | No | 1–5 |
| `title` | string \| null | No | Max 255; `null` clears |
| `comment` | string \| null | No | Max 5000; `null` clears |
| `images` | array | No | Max 5 items; when provided it **replaces** the whole image set (each item: `image_url` required, `alt_text` optional) |

**Response**

- Success: `200 OK` — `{ "success": true, "data": Review Object (customer projection) }`.
- Errors: `400` empty body, invalid fields, too many images · `401` not authenticated · `404` review not found, soft-deleted, or not owned by the session user

**Example Request**

```bash
curl -X PATCH "https://api.example.com/api/v1/reviews/rev_01J6XK8Q3M2N5B7V9C4D1E0F" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -d '{"rating":4,"comment":"Updated after a week of use."}'
```

---

### DELETE /api/v1/reviews/{review_public_id}

**Overview:** Soft-deletes the authenticated user's own review and hard-deletes its images in one transaction.

**Authentication:** Session required

**Request**

- Method: `DELETE` · URL: `/api/v1/reviews/{review_public_id}`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: `review_public_id` (string, required, `rev_...`)
- Query params: None · Body: None

**Response**

- Success: `204 No Content` (no body)
- Errors: `401` not authenticated · `404` review not found, soft-deleted, or not owned by the session user

**Example Request**

```bash
curl -X DELETE "https://api.example.com/api/v1/reviews/rev_01J6XK8Q3M2N5B7V9C4D1E0F" \
  -H "Cookie: session=<SESSION_TOKEN>"
```

---

### GET /api/v1/users/me/reviews

**Overview:** Returns the authenticated user's own reviews (paginated), including unapproved ones — the customer-facing management view.

**Authentication:** Session required

**Request**

- Method: `GET` · URL: `/api/v1/users/me/reviews`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Body: None
- Query params:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `page` | integer | No | Page number, 1-based (default `1`) |
| `limit` | integer | No | Page size (default `10`, 1–100) |
| `sort` | string | No | `created_at` or `rating`; `-` prefix for descending. Default `-created_at` |

**Response**

- Success: `200 OK` — `{ "success": true, "data": { "reviews": [ Review Object + "is_approved": true ], "pagination": { page, limit, total, has_more } } }`. This is the only customer projection that includes `is_approved`; no rating summary.
- Errors: `400` invalid query parameters · `401` not authenticated

**Example Request**

```bash
curl "https://api.example.com/api/v1/users/me/reviews?page=1&limit=10&sort=-created_at" \
  -H "Cookie: session=<SESSION_TOKEN>"
```

---

## 17. Reviews — Admin

Admin review responses use the Review Object extended with: `is_approved` (boolean, required), `customer_public_id` (`usr_...`), `customer_email`, and `deleted_at` (only surfaced when `include_deleted` used).

### GET /api/v1/admin/reviews

**Overview:** Returns all reviews across all products (paginated) for moderation — the review queue. Includes unapproved and (optionally) soft-deleted reviews.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `GET` · URL: `/api/v1/admin/reviews`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Body: None
- Query params:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `page` | integer | No | Page number, 1-based (default `1`) |
| `limit` | integer | No | Page size (default `10`, 1–100) |
| `search` | string | No | Case-insensitive substring (ILIKE; wildcards escaped) on product name, review title, comment, customer email, or customer name |
| `rating` | integer | No | Exact rating filter, 1–5 |
| `is_approved` | string | No | `true`, `false`, or `all`. Default `all` |
| `include_deleted` | boolean | No | Include soft-deleted reviews (default `false`); projection then carries `deleted_at` |
| `sort` | string | No | `created_at` or `rating`; `-` prefix for descending. Default `-created_at` |

**Response**

- Success: `200 OK` — `{ "success": true, "data": { "reviews": [ Review Object (admin projection) ], "pagination": { page, limit, total, has_more } } }`.
- Errors: `400` invalid query parameters · `401` not authenticated · `403` not admin/super_admin

**Example Request**

```bash
curl "https://api.example.com/api/v1/admin/reviews?page=1&limit=10&rating=1&is_approved=false&include_deleted=false&sort=-created_at" \
  -H "Cookie: session=<SESSION_TOKEN>"
```

---

### GET /api/v1/admin/reviews/{review_public_id}

**Overview:** Returns one review in any state (unapproved or soft-deleted included), with images and customer summary.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `GET` · URL: `/api/v1/admin/reviews/{review_public_id}`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: `review_public_id` (string, required, `rev_...`)
- Query params: None · Body: None

**Response**

- Success: `200 OK` — `{ "success": true, "data": Review Object (admin projection) }`.
- Errors: `400` invalid `review_public_id` format · `401` not authenticated · `403` not admin/super_admin · `404` review not found

**Example Request**

```bash
curl "https://api.example.com/api/v1/admin/reviews/rev_01J6XK8Q3M2N5B7V9C4D1E0F" \
  -H "Cookie: session=<SESSION_TOKEN>"
```

---

### PATCH /api/v1/admin/reviews/{review_public_id}

**Overview:** Moderates a review — approve/unapprove and/or edit its content. Partial update.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `PATCH` · URL: `/api/v1/admin/reviews/{review_public_id}`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: `review_public_id` (string, required, `rev_...`)
- Query params: None
- Request body: at least one field required (empty body → 400). `images` cannot be changed through this endpoint.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `is_approved` | boolean | No | Toggle moderation state |
| `rating` | integer | No | 1–5 |
| `title` | string \| null | No | Max 255; `null` clears |
| `comment` | string \| null | No | Max 5000; `null` clears |

**Response**

- Success: `200 OK` — `{ "success": true, "data": Review Object (admin projection) }`.
- Errors: `400` empty body, invalid fields, or approving a soft-deleted review · `401` not authenticated · `403` not admin/super_admin · `404` review not found

**Example Request**

```bash
curl -X PATCH "https://api.example.com/api/v1/admin/reviews/rev_01J6XK8Q3M2N5B7V9C4D1E0F" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -d '{"is_approved":true,"comment":"Edited by support after user clarification."}'
```

---

### DELETE /api/v1/admin/reviews/{review_public_id}

**Overview:** Soft-deletes any review and hard-deletes its images in one transaction.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `DELETE` · URL: `/api/v1/admin/reviews/{review_public_id}`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: `review_public_id` (string, required, `rev_...`)
- Query params: None · Body: None

**Response**

- Success: `204 No Content` (no body)
- Errors: `401` not authenticated · `403` not admin/super_admin · `404` review not found (deleting an already-deleted review → 404)

**Example Request**

```bash
curl -X DELETE "https://api.example.com/api/v1/admin/reviews/rev_01J6XK8Q3M2N5B7V9C4D1E0F" \
  -H "Cookie: session=<SESSION_TOKEN>"
```

---

## 18. Users — Admin

All admin user endpoints require a session and the `admin` or `super_admin` role. They operate on **customer** accounts only — targeting a non-customer (admin/super_admin) or deleted customer returns `404` to avoid revealing admin accounts.

**Customer Object (admin projection)**

```json
{
  "public_id": "usr_01K4...",
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane@example.com",
  "phone_number": "+15551234567",
  "role": "CUSTOMER",
  "status": "ACTIVE",
  "email_verified": true,
  "phone_verified": true,
  "created_at": "2026-08-01T10:00:00Z",
  "updated_at": "2026-08-01T10:00:00Z"
}
```

### GET /api/v1/admin/users

**Overview:** Returns a paginated list of customer accounts, with search, status filtering, soft-deleted inclusion, and sorting.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `GET` · URL: `/api/v1/admin/users`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: None · Body: None
- Query params:

| Name | Type | Required | Description |
| --- | --- | --- | --- |
| `page` | integer | No | Page number (default `1`) |
| `limit` | integer | No | Results per page, 1–100 (default `20`) |
| `search` | string | No | Case-insensitive match on first name, last name, or email |
| `status` | enum | No | Filter by `ACTIVE`, `SUSPENDED`, or `DELETED` |
| `include_deleted` | boolean | No | Include soft-deleted customers (default `false`) |
| `sort` | enum | No | Sort by `name`, `email`, or `created_at`; `-` prefix for descending. Default `-created_at` |

**Response**

- Success: `200 OK` — `{ "success": true, "data": [ Customer Object ], "pagination": { page, limit, total, totalPages, hasNext, hasPrev } }`.
- Errors: `400` invalid query parameters · `401` authentication required · `403` insufficient permissions · `500` unexpected error

**Example Request**

```bash
curl -X GET "https://api.example.com/api/v1/admin/users?page=1&limit=20&search=jane&status=ACTIVE&sort=-created_at" \
  -H "Cookie: session=<SESSION_TOKEN>"
```

---

### GET /api/v1/admin/users/{user_public_id}

**Overview:** Returns a single customer's profile.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `GET` · URL: `/api/v1/admin/users/{user_public_id}`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: `user_public_id` (string, required, `usr_...`)
- Query params: None · Body: None

**Response**

- Success: `200 OK` — `{ "success": true, "data": Customer Object }`.
- Errors: `400` invalid user ID · `401` authentication required · `403` insufficient permissions · `404` user does not exist, is an admin, or is a deleted customer (deleted customers only reachable via list with `include_deleted=true`) · `500` unexpected error

**Example Request**

```bash
curl -X GET "https://api.example.com/api/v1/admin/users/usr_01K4EXAMPLE" \
  -H "Cookie: session=<SESSION_TOKEN>"
```

---

### PATCH /api/v1/admin/users/{user_public_id}

**Overview:** Updates customer information (profile fields).

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `PATCH` · URL: `/api/v1/admin/users/{user_public_id}`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: `user_public_id` (string, required, `usr_...`)
- Query params: None
- Request body: all fields optional; at least one required.

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `first_name` | string | No | 1–100 chars |
| `last_name` | string | No | 1–100 chars |
| `email` | string | No | Valid email |
| `phone_number` | string | No | E.164, e.g. `+15551234567` |

**Response**

- Success: `200 OK` — `{ "success": true, "data": Customer Object }`.
- Errors: `400` invalid request (e.g. empty body) · `401` authentication required · `403` insufficient permissions · `404` customer not found (or the target is an admin) · `409` `email` or `phone_number` already used by another account · `422` validation failed · `500` unexpected error

**Example Request**

```bash
curl -X PATCH "https://api.example.com/api/v1/admin/users/usr_01K4EXAMPLE" \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"first_name":"Jane","phone_number":"+15559876543"}'
```

---

### PATCH /api/v1/admin/users/{user_public_id}/suspend

**Overview:** Suspends a customer account and revokes all of the customer's sessions in a single transaction so the account cannot log in while suspended.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `PATCH` · URL: `/api/v1/admin/users/{user_public_id}/suspend`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: `user_public_id` (string, required, `usr_...`)
- Query params: None · Body: None

**Response**

- Success: `200 OK` — `{ "success": true, "data": Customer Object }` with `status: "SUSPENDED"`.
- Errors: `400` customer is already suspended · `401` authentication required · `403` insufficient permissions · `404` customer not found (or the target is an admin) · `500` unexpected error

**Example Request**

```bash
curl -X PATCH "https://api.example.com/api/v1/admin/users/usr_01K4EXAMPLE/suspend" \
  -H "Cookie: session=<SESSION_TOKEN>"
```

---

### PATCH /api/v1/admin/users/{user_public_id}/activate

**Overview:** Reactivates a suspended customer account. The customer must log in again to obtain a fresh session.

**Authentication:** Session required · **Authorization:** admin, super_admin

**Request**

- Method: `PATCH` · URL: `/api/v1/admin/users/{user_public_id}/activate`
- Headers: `Cookie: session=<SESSION_TOKEN>`
- Path params: `user_public_id` (string, required, `usr_...`)
- Query params: None · Body: None

**Response**

- Success: `200 OK` — `{ "success": true, "data": Customer Object }` with `status: "ACTIVE"`.
- Errors: `400` customer is already active · `401` authentication required · `403` insufficient permissions · `404` customer not found (or the target is an admin) · `500` unexpected error

**Example Request**

```bash
curl -X PATCH "https://api.example.com/api/v1/admin/users/usr_01K4EXAMPLE/activate" \
  -H "Cookie: session=<SESSION_TOKEN>"
```

---

### PATCH /api/v1/admin/users/{user_public_id}/role

**Overview:** Promotes a customer to `ADMIN` or demotes an admin back to `CUSTOMER`. Idempotent for no-op requests. **Super-admin only.**

**Authentication:** Session required · **Authorization:** **super_admin only** (a regular `admin` gets `403` on any role change)

**Request**

- Method: `PATCH` · URL: `/api/v1/admin/users/{user_public_id}/role`
- Headers: `Content-Type: application/json` · `Cookie: session=<SESSION_TOKEN>`
- Path params: `user_public_id` (string, required, `usr_...`)
- Query params: None
- Request body:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `role` | enum | Yes | `CUSTOMER` or `ADMIN`. `SUPER_ADMIN` is rejected with `400` (CLI-only) |

**Response**

- Success: `200 OK`

  ```json
  { "success": true, "data": { "public_id": "usr_01K4...", "role": "ADMIN" } }
  ```

  No-op requests return `200` with the unchanged role.

- Errors:

| Status | Condition |
| --- | --- |
| 400 | Admin tries to change their own role, or `role` is `SUPER_ADMIN`/invalid |
| 403 | Actor is not a `SUPER_ADMIN`, or target role is `SUPER_ADMIN` (defensive; a super admin can never be demoted) |
| 404 | Target user not found |
| 409 | Demoting the last admin-privileged user (would leave zero `ADMIN`/`SUPER_ADMIN` accounts) |
| 500 | Unexpected server error |

**Example Request**

```bash
curl -X PATCH "https://api.example.com/api/v1/admin/users/usr_01K4EXAMPLE/role" \
  -H "Cookie: session=<SESSION_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"role":"ADMIN"}'
```

---

## 19. Documented But Not Implemented

These endpoints are specified in `docs/api/authentication/password-reset.md` but have **no route handler** in `src/modules/auth/routes/auth.routes.ts`. They are **not** part of the live API surface.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/v1/auth/password-reset` | Request a password reset email (202 with a fixed anti-enumeration message) |
| POST | `/api/v1/auth/password-reset/verify` | Verify the reset token and set a new password (204) |

Documented error codes (if/when implemented): `400` invalid request · `404` reset token not found · `410` token expired/used · `422` password does not meet policy · `500` unexpected error.

---

## Endpoint Index

**86 implemented endpoints + 2 documented-but-not-implemented.**

- **Authentication (9):** `POST /auth/register` · `POST /auth/login` · `GET /auth/session` · `GET /auth/sessions` · `DELETE /auth/session` · `DELETE /auth/sessions` · `DELETE /auth/sessions/{session_public_id}` · `POST /auth/email-verification/verify` · `POST /auth/email-verification/resend`
- **Users (8):** `GET /users/me` · `PATCH /users/me` · `DELETE /users/me` · `PATCH /users/me/password` · `POST /users/me/email` · `POST /users/me/email/verify` · `POST /users/me/phone-number` · `POST /users/me/phone-number/verify`
- **Addresses (5):** `GET|POST /users/me/addresses` · `GET|PATCH|DELETE /users/me/addresses/{address_public_id}`
- **Products — public (2):** `GET /products` · `GET /products/{product_public_id}`
- **Products — admin (6):** `GET /admin/products/uploads/imagekit-auth` · `GET|POST /admin/products` · `GET|PATCH|DELETE /admin/products/{product_public_id}`
- **Product variants — admin (5):** `GET|POST /admin/products/{product_public_id}/variants` · `GET|PATCH|DELETE /admin/products/{product_public_id}/variants/{variant_public_id}`
- **Product images — admin (5):** `GET|POST /admin/products/{product_public_id}/images` · `GET|PATCH|DELETE /admin/products/{product_public_id}/images/{image_public_id}`
- **Variant images — admin (5):** `GET|POST /admin/products/{product_public_id}/variants/{variant_public_id}/images` · `GET|PATCH|DELETE /admin/products/{product_public_id}/variants/{variant_public_id}/images/{variant_image_public_id}`
- **Categories — public (3):** `GET /categories` · `GET /categories/{category_public_id}` · `GET /categories/{category_public_id}/products`
- **Categories — admin (7):** `GET|POST /admin/categories` · `GET|PATCH|DELETE /admin/categories/{category_public_id}` · `PUT|DELETE /admin/categories/{category_public_id}/products/{product_public_id}`
- **Inventory — admin (4):** `GET|POST /admin/inventory` · `GET|PATCH /admin/inventory/{variant_public_id}`
- **Cart (5):** `GET /cart` · `POST /cart/items` · `PATCH|DELETE /cart/items/{variant_public_id}` · `DELETE /cart`
- **Orders — customer (3):** `POST /orders` · `GET /orders` · `GET /orders/{order_public_id}`
- **Orders — admin (3):** `GET /admin/orders` · `GET /admin/orders/{order_public_id}` · `PATCH /admin/orders/{order_public_id}`
- **Reviews — public (2):** `GET /products/{product_public_id}/reviews` · `GET /reviews/{review_public_id}`
- **Reviews — authenticated (4):** `POST /reviews` · `PATCH /reviews/{review_public_id}` · `DELETE /reviews/{review_public_id}` · `GET /users/me/reviews`
- **Reviews — admin (4):** `GET /admin/reviews` · `GET /admin/reviews/{review_public_id}` · `PATCH /admin/reviews/{review_public_id}` · `DELETE /admin/reviews/{review_public_id}`
- **Users — admin (6):** `GET /admin/users` · `GET /admin/users/{user_public_id}` · `PATCH /admin/users/{user_public_id}` · `PATCH /admin/users/{user_public_id}/suspend` · `PATCH /admin/users/{user_public_id}/activate` · `PATCH /admin/users/{user_public_id}/role`
