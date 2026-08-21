# User Login Flow

## Overview

The login flow authenticates an existing user, creates a new authenticated session, and returns a secure session cookie.

---

## Endpoint

```
POST /api/v1/auth/login
```

---

## Request Body

| Field | Type | Required | Validation |
| --- | --- | --- | --- |
| email | string | Yes | Valid email address |
| password | string | Yes | Required |

### Example

```json
{
  "email": "ahmed@example.com",
  "password": "StrongPassword123!"
}
```

---

## Successful Response

**200 OK**

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

# Login Flow

1. Client submits the login request.
2. API validates the request payload.
3. API looks up the user by email.
4. API verifies the password against the stored password hash.
5. API checks that the account is active.
6. A new authenticated session is created.
7. The session cookie is attached to the response.
8. API returns **200 OK**.

---

# Post Login State

After a successful login:

- ✅ User is authenticated.
- ✅ Session is active.
- ✅ Secure session cookie is stored.
- 📧 Email verification status is returned.

If the email is not verified:

- The user may continue using the application.
- Protected operations that require a verified email remain blocked.

---

# Error Responses

| Status | Reason |
| --- | --- |
| 400 Bad Request | Invalid request body |
| 401 Unauthorized | Invalid email or password |
| 403 Forbidden | Account is suspended or disabled |
| 429 Too Many Requests | IP rate limit exceeded or account temporarily locked after 10 consecutive failed attempts (15-minute lockout) |
| 500 Internal Server Error | Unexpected server error |

> **Security Note:** Always return the same `401 Unauthorized` response for an incorrect email or password. Do not reveal whether the email exists.
> 
> **Brute-Force Protection:** The endpoint is rate-limited per IP (10 requests / 15 min, `RateLimit-*` headers on 429). Additionally, 10 consecutive failed logins for one email trigger a 15-minute temporary lockout that returns the same generic message regardless of whether the account exists; a successful login resets the counter and the lockout always expires on its own (never permanent).

Example:

```json
{
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password."
  }
}
```

---

# Security Considerations

- Passwords are verified using a secure password hashing algorithm.
- Password hashes are never returned to the client.
- Session identifiers are cryptographically secure and unpredictable.
- Each successful login creates a new session.
- Multiple concurrent sessions across different devices are supported.
- Failed login attempts should be rate-limited to mitigate brute-force attacks.
- Audit logs should record successful and failed login attempts.

---

# Notes

- Authentication is session-based using secure HttpOnly cookies.
- Public IDs are exposed externally; internal database IDs are never returned.
- Email verification is **not** required to log in, but is required for specific protected operations (e.g., checkout).