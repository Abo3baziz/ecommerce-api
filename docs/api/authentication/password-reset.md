# Password Reset Flow

## Overview

The Password Reset flow allows users who have forgotten their password to regain access to their account.

The flow consists of two steps:

1. Request a password reset email.
2. Verify the reset token and set a new password.

---

# Request Password Reset

## Endpoint

```
POST /api/v1/auth/password-reset
```

---

## Authentication

Not Required

---

## Request Body

```json
{
  "email": "ahmed@example.com"
}
```

---

## Successful Response

**202 Accepted**

```json
{
  "message": "If an account exists for the provided email, a password reset email has been sent."
}
```

> **Important:** Always returning the same response regardless of whether the email exists to prevent account enumeration. hell yeaaah security baby
> 

---

# Password Reset Email

Example reset link:

```
<https://example.com/reset-password?token=><reset_token>
```

The reset token is:

- Cryptographically random
- Single-use
- Time-limited
- Stored as a hash in the database

---

# Reset Password

## Endpoint

```
POST /api/v1/auth/password-reset/verify
```

---

## Authentication

Not Required

---

## Request Body

```json
{
  "token": "<reset_token>",
  "new_password": "NewStrongPassword123!"
}
```

---

## Validation

The API validates that:

- The token exists.
- The token has not expired.
- The token has not been used.
- The new password satisfies the password policy.

---

## Successful Response

**204 No Content**

---

# Flow

1. User requests a password reset.
2. API validates the email format.
3. API looks up the user by email.
4. If the user exists:
    - Existing unused reset tokens are invalidated.
    - A new reset token is generated.
    - The token hash is stored.
    - A password reset email is queued.
5. API returns **202 Accepted**.
6. User clicks the reset link.
7. Client submits the reset token and the new password.
8. API validates the token.
9. API validates the new password.
10. API hashes the new password.
11. API updates the user's password.
12. API invalidates all active sessions for the user.
13. API invalidates the reset token.
14. API returns **204 No Content**.

---

# Error Responses

| Status | Reason |
| --- | --- |
| 400 Bad Request | Invalid request |
| 404 Not Found | Reset token not found |
| 410 Gone | Reset token expired or already used |
| 422 Unprocessable Entity | Password does not meet the password policy |
| 500 Internal Server Error | Unexpected server error |

---

# Security Considerations

- Reset tokens are cryptographically random.
- Only token hashes are stored.
- Reset tokens are single-use.
- Reset tokens expire after a configurable period.
- Previous unused reset tokens are invalidated when a new one is issued.
- Password reset emails are sent asynchronously.
- Rate limiting should be applied to password reset requests.
- Password reset attempts should be audited.
- All active sessions are invalidated after a successful password reset.

---

# Notes

- Authentication is not required for this flow.
- Users must sign in again after resetting their password.
- Passwords are never stored in plaintext.
- Internal database IDs are never exposed.