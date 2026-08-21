# Session Management

## Overview

Sessions represent authenticated client connections to a user's account. Each successful login or registration creates a new session.

A user may have multiple active sessions simultaneously across different devices and browsers.

---

# Session Lifecycle

```
Register/Login
      │
      ▼
Create Session
      │
      ▼
Store Session
      │
      ▼
Return HttpOnly Cookie
      │
      ▼
Authenticated Requests
      │
      ▼
Session Expires or Logout
      │
      ▼
Session Invalidated
```

---

# Session Cookie

The server returns the session identifier as a secure cookie.

```
Set-Cookie:
session=<session_id>;
HttpOnly;
Secure;
SameSite=Lax;
Path=/;
```

Properties:

- HttpOnly
- Secure
- SameSite=Lax
- Path=/
- Configurable expiration

---

# Endpoints

## Get Current Session

### Endpoint

```
GET /api/v1/auth/session
```

Returns information about the authenticated session.

### Response

```json
{
  "authenticated": true,
  "user": {
    "public_id": "usr_01K4X8Y9P4M4G8N6F9V2A1B3C",
    "email_verified": false
  },
  "session": {
    "created_at": "2026-07-29T12:00:00Z",
    "expires_at": "2026-08-28T12:00:00Z"
  }
}
```

---

## Get Active Sessions

### Endpoint

```
GET /api/v1/auth/sessions
```

Returns all active sessions for the authenticated user.

### Response

```json
[
  {
    "public_id": "ses_01K4...",
    "current": true,
    "device": "Chrome on Windows",
    "ip_address": "203.0.113.xxx",
    "last_activity_at": "2026-07-29T15:43:21Z",
    "created_at": "2026-07-29T12:00:00Z"
  },
  {
    "public_id": "ses_01K5...",
    "current": false,
    "device": "Safari on iPhone",
    "ip_address": "198.51.100.xxx",
    "last_activity_at": "2026-07-28T18:17:44Z",
    "created_at": "2026-07-25T10:12:18Z"
  }
]
```

---

## Logout Current Session

### Endpoint

```
DELETE /api/v1/auth/session
```

Invalidates the current authenticated session.

### Response

**204 No Content**

The server invalidates the session and clears the session cookie.

---

## Logout Specific Session

### Endpoint

```
DELETE /api/v1/auth/sessions/{session_public_id}
```

Terminates one specific session.

### Response

**204 No Content**

---

## Logout All Other Sessions

### Endpoint

```
DELETE /api/v1/auth/sessions
```

Invalidates every active session except the current one.

### Response

**204 No Content**

---

# Session Validation

Every authenticated request performs the following checks:

1. Read session cookie.
2. Verify session exists.
3. Verify session is active.
4. Verify session has not expired.
5. Verify the session is not idle (`last_activity_at` within `SESSION_IDLE_TIMEOUT_MS`; every authenticated request slides `last_activity_at` forward).
6. Load associated user.
7. Attach authenticated user to the request context.

If any check fails:

```
401 Unauthorized
```

---

# Session Expiration

Policy:

- Absolute TTL: `SESSION_TTL_MS` (30 days) since creation — never extended (no sliding expiration).
- Idle timeout: `SESSION_IDLE_TIMEOUT_MS` (**14 days**) since last activity — enforced by the authentication middleware.
- Effective lifetime = `min(SESSION_TTL_MS, last_activity_at + SESSION_IDLE_TIMEOUT_MS)`; every authenticated request slides `last_activity_at` forward but never extends `expires_at`.
- Idle/expired sessions are rejected with 401 and removed by the session cleanup job.

---

# Security Considerations

- Session identifiers are cryptographically random.
- Only a hash of the session identifier is stored in the database.
- Session cookies are HttpOnly.
- Session cookies are Secure in production.
- Session identifiers are rotated after login and other sensitive authentication events.
- Sessions are invalidated immediately on logout.
- Session IDs are never exposed in API responses.
- All authenticated endpoints require a valid session.