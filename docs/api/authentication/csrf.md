# CSRF Protection

> Part of the Authentication module. This document defines how cross-site request forgery (CSRF) protection is applied to the API, how clients obtain and send a CSRF token, and which requests are protected.

## Overview

The API uses the **Double Submit Cookie** pattern for CSRF protection, implemented with the `csrf-csrf` package.

- A **CSRF token** is an opaque, HMAC-signed value that is bound to the caller's session.
- The token is delivered in two places:
  - a cookie named `x-csrf-token` (HttpOnly, set by the API),
  - the same value returned in the response body of the token endpoint.
- On every protected write request the client must send the token back in the **`x-csrf-token` header**.
- The server rejects the request with **403** unless the header token matches the token cookie AND the token's HMAC recomputes correctly for the current session.

Because the token is bound to the session cookie value, a new login (new session) invalidates earlier tokens; clients must fetch a fresh token after every login/registration.

## Client flow

1. Authenticate: `POST /api/v1/auth/register` or `POST /api/v1/auth/login`.
2. Fetch a token: `GET /api/v1/auth/csrf-token` — requires the session cookie. The response sets the `x-csrf-token` cookie and returns:

   ```json
   {
     "success": true,
     "data": {
       "csrf_token": "…"
     }
   }
   ```

3. Send the token on every **protected write** as the `x-csrf-token` request header. The `x-csrf-token` cookie is sent automatically by the browser.

## What is protected

CSRF validation applies to **non-safe** methods (`POST`, `PATCH`, `PUT`, `DELETE`) that carry a session cookie. Safe methods (`GET`, `HEAD`, `OPTIONS`) are never checked.

- Protected (validated): every authenticated write — profile updates/deletes, password/email/phone changes, addresses, cart, checkout/orders, reviews, admin operations, logout / session revocation, email-verification resend.
- Skipped (never validated): requests **without a session cookie** — which covers the pure public paths `POST /auth/register`, `POST /auth/login`, `POST /auth/password-reset`, `POST /auth/password-reset/verify`, and `POST /auth/email-verification/verify` (these carry a secret token or credentials in the body, and the same-origin `SameSite=Lax` session cookie already stops cross-site login-cookie attachment). An authenticated user calling one of those public routes is still CSRF-checked, which is intentional (they are state-changing for the session).

## Cookie attributes

The `x-csrf-token` cookie is set with:

| Attribute | Value |
|-----------|-------|
| `httpOnly` | `true` |
| `sameSite` | `lax` |
| `secure` | `true` in production, `false` otherwise |
| `path` | `/` |

The token is read from the response body (not from `document.cookie`), so keeping the cookie `httpOnly` does not break legitimate clients.

## Troubleshooting

| Symptom | Meaning |
|---------|---------|
| 403 `Invalid CSRF token` | The write carried no `x-csrf-token` header, the header did not match the cookie, or the token/session pair is stale. Re-fetch `GET /api/v1/auth/csrf-token` and retry. |
| 401 on `GET /api/v1/auth/csrf-token` | No valid session — log in or register first. |