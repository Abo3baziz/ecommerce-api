# Change Phone Number Flow

## Overview

The Change Phone Number flow allows an authenticated user to update their phone number.

The new phone number is not applied immediately. The user must first verify ownership of the new phone number by entering a one-time password (OTP) sent via SMS.

---

# Request Phone Number Change

## Endpoint

```
POST /api/v1/users/me/phone-number
```

## Authentication

Required

---

## Request Body

```json
{
  "new_phone_number": "+201234567890",
  "password": "CurrentPassword123!"
}
```

---

## Validation

The API validates that:

- The user is authenticated.
- The password is correct.
- The phone number is valid.
- The phone number is different from the current one.
- The phone number is not already in use.

---

## Successful Response

**202 Accepted**

```json
{
  "message": "Verification code sent."
}
```

---

# Verify Phone Number

## Endpoint

```
POST /api/v1/users/me/phone-number/verify
```

---

## Request Body

```json
{
  "otp": "123456"
}
```

---

## Successful Response

**200 OK**

```json
{
  "message": "Phone number updated successfully.",
  "phone_number": "+201234567890"
}
```

---

# Flow

1. User submits a phone number change request.
2. API validates the request.
3. API verifies the user's password.
4. API checks that the new phone number is available.
5. API generates a verification code.
6. API stores the hashed verification code and the pending phone number.
7. API sends the verification code via SMS.
8. User enters the verification code.
9. API validates the verification code.
10. API updates the user's phone number.
11. API removes the pending phone number change request.
12. API returns success.

---

# Error Responses

| Status | Reason |
| --- | --- |
| 400 Bad Request | Invalid request |
| 401 Unauthorized | Invalid password or authentication required |
| 404 Not Found | Verification request not found |
| 409 Conflict | Phone number already exists |
| 410 Gone | Verification code expired |
| 422 Unprocessable Entity | Invalid verification code |
| 429 Too Many Requests | Too many verification attempts |
| 500 Internal Server Error | Unexpected server error |

---

# Security Considerations

- Password confirmation is required.
- The current phone number is not changed until verification succeeds.
- Verification codes are cryptographically secure.
- Only a hash of the verification code is stored.
- Verification codes are single-use.
- Verification codes expire after a configurable period.
- Previous pending phone number change requests are invalidated when a new request is created.
- SMS sending should be asynchronous.
- Rate limiting should be applied to both SMS sending and verification attempts.

---

# Notes

- The current authenticated session remains valid after the phone number change.
- Internal database IDs are never exposed.
- Public IDs remain unchanged.
- The new phone number becomes active only after successful verification.