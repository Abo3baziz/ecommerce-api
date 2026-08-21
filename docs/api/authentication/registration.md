# User Registration Flow

## Overview

The user registration flow creates a new customer account, starts an authenticated session, and sends an email verification link. A newly registered user is immediately signed in, but certain actions remain restricted until their email address is verified.

---

## Endpoint

```
POST /api/v1/auth/register
```

---

## Request Body

| Field | Type | Required | Validation Rules |
| --- | --- | --- | --- |
| first_name | string | Yes | 1-100 characters |
| last_name | string | Yes | 1-100 characters |
| phone_number | string | Yes | E.164 format |
| email | string | Yes | Valid email address, unique |
| password | string | Yes | Meets password policy |

### Example

```json
{
  "first_name": "Ahmed",
  "last_name": "Aziz",
  "phone_number": "+201234567890",
  "email": "ahmed@example.com",
  "password": "StrongPassword123!"
}
```

---

## Successful Response

**201 Created**

### Response Body

```json
{
  "public_id": "usr_01K4X8Y9P4M4G8N6F9V2A1B3C",
  "email_verified": false
}
```

### Response Headers

```
Set-Cookie:
session=<session_token>;
HttpOnly;
Secure;
SameSite=Lax;
Path=/;
```

The session cookie is stored by the browser and is automatically included in subsequent requests.

---

# Registration Flow

1. Client submits the registration request.
2. API validates the request payload.
3. API checks that:
    - Email is unique.
    - Phone number is unique.
4. Password is hashed.
5. A new user record is created.
6. A new authenticated session is created.
7. An email verification token is generated.
8. A signed email verification link is created.
9. The verification email is queued for delivery.
10. The session cookie is attached to the response.
11. API returns **201 Created**.

---

# Post Registration State

Immediately after registration:

- ✅ User account exists.
- ✅ User is authenticated.
- ✅ Session is active.
- ❌ Email is not yet verified.
- 📧 Verification email has been sent.

---

# Restricted Operations Before Email Verification

The user may:

- Browse products.
- Search products.
- View product details.
- Manage their profile.
- Add items to their cart.
- Update their cart.
- Sign out.
- Sign in on another device.

The user may **not**:

- Place an order.
- Checkout.
- Change their email address.
- Perform any operation requiring a verified email.

---

# Error Responses

| Status | Reason |
| --- | --- |
| 400 Bad Request | Invalid request body |
| 409 Conflict | Email already exists |
| 409 Conflict | Phone number already exists |
| 422 Unprocessable Entity | Password does not meet policy |
| 429 Too Many Requests | IP rate limit exceeded (20 registrations / 15 min; spam defense) |
| 500 Internal Server Error | Unexpected server error |

---

# Notes

- Passwords are never stored in plaintext.
- Passwords are hashed using a secure password hashing algorithm.
- Public IDs are returned to clients instead of internal database IDs.
- Session authentication is implemented using secure HttpOnly cookies.
- Email verification is performed using signed verification links.
- Verification emails are sent asynchronously and should not block the registration request.