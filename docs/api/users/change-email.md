# Change User Email Flow

## Overview

The Change User Email flow allows an authenticated user to update their email address.

The new email address is not applied immediately. The user must first verify ownership of the new email address using a verification link.

---

# Request Email Change

## Endpoint

```
POST /api/v1/users/me/email
```

## Authentication

Required

---

## Request Body

```json
{
  "new_email": "new@example.com",
  "password": "CurrentPassword123!"
}
```

---

## Validation

The API validates that:

- The user is authenticated.
- The password is correct.
- The new email is valid.
- The new email is different from the current email.
- The new email is not already in use.

---

## Successful Response

**202 Accepted**

```json
{
  "message": "Verification email sent."
}
```

---

# Email Change Verification

Example verification link:

```
<https://example.com/verify-email-change?token=><verification_token>
```

The verification token is:

- Cryptographically random
- Single-use
- Time-limited
- Stored as a hash

---

# Verify Email Change

## Endpoint

```
POST /api/v1/users/me/email/verify
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
  "message": "Email updated successfully.",
  "email": "new@example.com",
  "email_verified": true
}
```

---

# Flow

1. User submits an email change request.
2. API validates the request.
3. API verifies the user's password.
4. API checks that the new email is available.
5. API generates an email change verification token.
6. API stores the hashed token and the pending email.
7. API sends a verification email to the new address.
8. User clicks the verification link.
9. Client submits the verification token.
10. API validates the token.
11. API updates the user's email.
12. API removes the pending email change record.
13. API returns success.

---

# Error Responses

| Status | Reason |
| --- | --- |
| 400 Bad Request | Invalid request |
| 401 Unauthorized | Invalid password or authentication required |
| 404 Not Found | Verification token not found |
| 409 Conflict | Email already exists |
| 410 Gone | Verification token expired or already used |
| 500 Internal Server Error | Unexpected server error |

---

# Security Considerations

- Password confirmation is required.
- The current email is not changed until verification succeeds.
- Verification tokens are single-use.
- Verification tokens expire after a configurable period.
- Only token hashes are stored.
- Previous pending email change requests are invalidated when a new request is created.
- Verification emails are sent asynchronously.
- Rate limiting should be applied to email change requests.

---

# Notes

- The current authenticated session remains valid after the email change.
- Internal database IDs are never exposed.
- Public IDs remain unchanged.
- The new email becomes active only after successful verification.