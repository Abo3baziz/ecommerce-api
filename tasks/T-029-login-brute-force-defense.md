# T-029 — Login/register brute-force defense

| Field | Value |
|-------|-------|
| **ID** | T-029 |
| **Priority** | P1 |
| **Status** | done |
| **Type** | `feature` |
| **Branch** | `feature/login-rate-limiting` |
| **Depends on** | — (IP keying note below) |
| **Blocks** | — |

## Problem

`POST /auth/login` and `POST /auth/register` carried only `validate()` (`src/modules/auth/routes/auth.routes.ts`). The only protection was the global limiter (100 req / 15 min / IP, in-memory store). Credential stuffing ≈9,600 guesses/day/IP, scaling linearly across distributed IPs. No account lockout existed anywhere.

## Goal

Throttle authentication attempts per-IP and per-account without enabling denial-of-service against a victim's account.

## Scope

- Dedicated `loginRateLimiter` via the shared factory (10/15min/IP default) on login.
- Per-email (hashed) failure counter with a temporary lockout after N consecutive failures; unlock on successful login or expiry.
- Lighter limiter on register (spam defense).
- Document the in-memory store limitation; evaluate shared store (Redis) before multi-instance deployment.

## Implementation

- `loginRateLimiter` (default **10 req/15min/IP**) on `POST /auth/login` and `registerRateLimiter` (default **20 req/15min/IP**) on `POST /auth/register`, both via the shared factory; limits are env-tunable through `LOGIN_RATE_LIMIT_MAX` / `REGISTER_RATE_LIMIT_MAX` so test suites can raise them (`.env.test` sets 100000 locally and in CI).
- Per-account lockout in `src/modules/auth/utils/loginAttemptTracker.ts`: in-memory map keyed by SHA-256(lowercased email); after `LOGIN_MAX_FAILED_ATTEMPTS` (10) consecutive failures the account is locked for `LOGIN_LOCKOUT_MS` (15 min). Lockout is temporary only: it auto-expires and restarts a fresh cycle, a successful login clears the counter, an active lock absorbs further failures without extending, and unknown emails are counted identically with a generic message (no enumeration). Wired into `auth.service.login()` — failures recorded only on invalid credentials; a valid password always clears the counter even for suspended accounts.
- New `TooManyRequestsError` (429); both limiters return `{ success: false, message }` with standard `RateLimit-*` headers.

## Decisions

- Register gets the lighter limit because registration cannot verify credentials (no stuffing surface), only spam accounts; login carries the tighter cap.
- Lockout policy is documented as non-permanent by design (auto-expiry + reset-on-success): repeated attacks can extend unavailability only in 15-minute windows, never indefinitely.
- The original "Depends on T-033 (correct IP keying behind proxies)" dependency referenced a task that does not exist in `tasks/`; deployment-specific proxy/trust-proxy configuration remains out of scope here. Behind a reverse proxy, `express-rate-limit` sees the proxy IP unless `trust proxy` is configured at deploy time — covered by the shared-store/ops note in `docs/AUTHENTICATION.md`.

## Acceptance criteria

- [x] Exceeding the login limit returns 429 with standard headers.
- [x] Failed-attempt lockout cannot be abused to lock out a victim permanently (documented policy).
- [x] Tests cover 429 path and reset-on-success behavior.

## References

- `docs/AUTHENTICATION.md` → "Brute-Force Protection"
- `docs/api/authentication/login.md`, `docs/api/authentication/registration.md` (429 rows)
- `src/middleware/rateLimiter.ts`
