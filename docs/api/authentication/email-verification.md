# Email Verification Flow

## Overview

Email verification confirms ownership of the user's email address.

After a successful registration, the user is immediately authenticated and an email verification link is sent to their registered email address.

The verification link is single-use and expires after a configurable period.

---

# Endpoint

```
POST /api/v1/auth/email-verification/resend
```

Sends (or re-sends) a verification email to the authenticated user.

---

## Authentication

Required

---

## Successful Response

**202 Accepted**

```json
{
  "message": "Verification email sent."
}
```

---

# Verification Email

Example verification URL:

```
<https://example.com/verify-email?token=><verification_token>
```

The token should be:

- Cryptographically random
- Single-use
- Time-limited
- Stored as a hash in the database

---

# Verify Email

## Endpoint

```
POST /api/v1/auth/email-verification/verify
```

---

## Request Body

```json
{
  "token": "<verification_token>"
}
```

---

## Successful Response

**200 OK**

```json
{
  "message": "Email verified successfully."
}
```

---

# Verification Flow

1. User registers.
2. User account is created.
3. User session is created.
4. Verification token is generated.
5. Verification token hash is stored.
6. Verification email is queued.
7. User clicks the verification link.
8. Client submits the verification token.
9. API validates the token.
10. API verifies:
    - Token exists.
    - Token has not expired.
    - Token has not been used.
11. User's email is marked as verified.
12. Verification token is invalidated.
13. API returns success.

---

# Re-send Verification Email

## Endpoint

```
POST /api/v1/auth/email-verification/resend
```

Authentication required.

If the user's email is already verified:

```
409 Conflict
```

Otherwise:

1. Existing unused verification tokens are invalidated.
2. A new verification token is generated.
3. A new verification email is queued.
4. API returns **202 Accepted**.

---

# Error Responses

| Status | Reason |
| --- | --- |
| 400 Bad Request | Invalid request |
| 401 Unauthorized | Authentication required |
| 404 Not Found | Verification token not found |
| 409 Conflict | Email already verified |
| 410 Gone | Verification token has expired or has already been used |
| 500 Internal Server Error | Unexpected server error |

---

# Security Considerations

- Verification tokens are cryptographically random.
- Only the token hash is stored in the database.
- Tokens are single-use.
- Tokens have an expiration time.
- A new verification request invalidates previous unused tokens.
- Successful verification invalidates the token immediately.
- Verification emails are sent asynchronously.
- Rate limiting should be applied to verification email requests.

---

# Notes

- Email verification does not create a new session.
- The current authenticated session remains active after verification.
- The `email_verified` flag is updated immediately after successful verification.
- Protected operations that require a verified email become available immediately after verification.