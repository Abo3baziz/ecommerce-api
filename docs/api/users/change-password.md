# Change Password Flow

## Overview

The Change Password flow allows an authenticated user to update their password.

The user must provide their current password before setting a new password.

After a successful password change, all existing sessions except the current session are invalidated.

---

# Change Password

## Endpoint

```
PATCH /api/v1/users/me/password
```

## Authentication

Required

---

## Request Body

```json
{
  "current_password": "CurrentPassword123!",
  "new_password": "NewStrongPassword456!"
}
```

---

## Validation

The API validates that:

- The user is authenticated.
- The current password is correct.
- The new password meets the password policy.
- The new password is different from the current password.

---

## Successful Response

**204 No Content**

---

# Flow

1. User submits a password change request.
2. API validates the request.
3. API verifies the current password.
4. API validates the new password against the password policy.
5. API hashes the new password.
6. API updates the stored password hash.
7. API invalidates all other active sessions.
8. API keeps the current session active.
9. API returns **204 No Content**.

---

# Error Responses

| Status | Reason |
| --- | --- |
| 400 Bad Request | Invalid request |
| 401 Unauthorized | Invalid current password or authentication required |
| 422 Unprocessable Entity | New password does not meet the password policy |
| 500 Internal Server Error | Unexpected server error |

Example:

```json
{
  "error": {
    "code": "INVALID_CURRENT_PASSWORD",
    "message": "The current password is incorrect."
  }
}
```

---

# Security Considerations

- Passwords are never stored in plaintext.
- Passwords are hashed using a secure password hashing algorithm.
- The current password is always required.
- The new password must satisfy the configured password policy.
- The new password cannot be the same as the current password.
- All sessions except the current session are invalidated after a successful password change.
- All unused `PASSWORD_RESET`, `CHANGE_EMAIL`, and `CHANGE_PHONE_NUMBER` tokens are invalidated in the same transaction as the password update; an outstanding reset link returns 410 if used afterwards. Pending `REGISTER_EMAIL` tokens are not affected.
- Password changes should be recorded in audit logs.
- Rate limiting should be applied to password change attempts.

---

# Notes

- The current authenticated session remains active.
- Users on other devices must sign in again.
- Internal database IDs are never exposed.
- Public IDs remain unchanged.