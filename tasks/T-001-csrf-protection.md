# T-001 — Wire CSRF protection for cookie-authenticated writes

| Field | Value |
|-------|-------|
| **ID** | T-001 |
| **Priority** | P0 |
| **Status** | done |
| **Type** | `bugfix` / security |
| **Branch** | `bugfix/csrf-protection` |
| **Depends on** | — |
| **Blocks** | Real browser clients with cookie auth |

## Problem

`csrf-csrf` is installed but **not wired** into the request pipeline. Cookie-authenticated write endpoints (POST/PATCH/DELETE) are vulnerable to cross-site request forgery from a malicious origin that the browser will attach cookies to.

Documented in `docs/APIDOG_TESTING.md` §11 Notes.

## Goal

Enable CSRF protection for all state-changing, cookie-authenticated routes without breaking API clients that correctly fetch and send the token.

## Scope

- Wire `csrf-csrf` (or equivalent double-submit / synchronizer-token pattern) into Express middleware.
- Expose a documented way for clients to obtain the CSRF token (cookie + header, or dedicated GET endpoint).
- Apply to authenticated write routes (users, cart, orders, admin, auth logout/session revoke, etc.).
- Skip or carefully handle pure public POSTs if needed (`/auth/login`, `/auth/register`, password-reset) — decide and document.
- Update `docs/AUTHENTICATION.md`, `docs/APIDOG_TESTING.md`, and relevant API docs.
- Integration + e2e tests: missing/invalid token → 403; valid token → success.

## Out of scope

- Changing session cookie attributes beyond what CSRF requires.
- Frontend SPA implementation (document the contract only).

## Acceptance criteria

- [x] CSRF middleware active in non-test environments (or always, with test helpers) — active in all environments (Double Submit via `csrf-csrf`); anonymous requests skipped, safe methods ignored.
- [x] Cookie-authenticated writes without a valid CSRF token return **403** (`Invalid CSRF token`).
- [x] Documented client flow (fetch token → send header on writes) — `GET /api/v1/auth/csrf-token` + `x-csrf-token` header; see `docs/api/authentication/csrf.md`.
- [x] Apidog/testing guide updated — `docs/APIDOG_TESTING.md` §5.4, request tree, troubleshooting, notes; `docs/TESTING.md` §13.
- [x] Tests cover happy path + rejection — `tests/e2e/auth/csrf.api.test.ts` (13 tests); all existing e2e write tests now send the token via `csrfHeaders()`.
- [x] `npm run typecheck`, `npm run build`, `npm test` green (60 files / 1020 tests).

## References

- `docs/REQUIREMENTS.md` — Security Requirements (CSRF)
- `docs/APIDOG_TESTING.md` — §11 Notes (CSRF not wired)
- `docs/AUTHENTICATION.md`
- `package.json` — `csrf-csrf` dependency
