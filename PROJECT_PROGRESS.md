# PROJECT_PROGRESS.md

## Project Progress

### Completed
- Synced Prisma schema via `db:pull` (imported user's fixes from `Ecommerce` schema) and regenerated the client.
- Moved generated Prisma client to `src/generated/prisma` (was outside `rootDir`, blocking `tsc`); `.gitignore` updated.
- Added dev `SESSION_SECRET` + `CORS_ORIGIN` to `.env`.
- Created `src/config/database.ts` (Prisma client via `PrismaPg` adapter), deriving schema name from the connection string so queries hit the `Ecommerce` schema.
- Fixed typecheck/startup blockers: `validate.ts` (Express 5 `req.query` getter-only), `express.d.ts` (generated `users` type + `SessionData.userId`), `authentication.ts` (snake_case client fields), `server.ts` import path.
- Implemented minimal `POST /api/v1/auth/register`: validator, dto, repository, service, controller, routes; mounted at `/api/v1/auth`.
- Verified end-to-end: 201 Created (`public_id`, `email_verified: false`), 409 duplicate email/phone, 400 validation, bcrypt (12 rounds) stored; `npm run build` passes.
- Extended registration to generate an email verification token: crypto random token, SHA-256 hash persisted to `verification_tokens` (`REGISTER_EMAIL`, 24h expiry, `vrf_…` public id).
- Integrated **Resend** for real verification email delivery: `RESEND_API_KEY` + `RESEND_FROM_EMAIL` (default `onboarding@resend.dev`) added to env schema; shared mailer module created; `register()` now sends the email non-blocking (errors logged, never fail the request).
- Verified live: standalone mailer test to `delivered@resend.dev` succeeded; register endpoint created token row + dispatched email; test rows cleaned up; `npm run typecheck` + `npm run build` pass.
- Implemented `POST /api/v1/auth/email-verification/verify`: hashes incoming token, looks up unused/unexpired `REGISTER_EMAIL` token, then in a transaction marks `users.email_verified_at` and invalidates the token (`used_at` + `verified_at`).
- Added `GoneError` (410) and wired statuses per docs: 200 verified / 400 invalid body / 404 token not found / 410 used or expired.
- **Fixed a timezone bug**: `@prisma/adapter-pg` read timestamptz shifted by the session timezone (`Africa/Cairo`, +3h), which made expired tokens look valid. Forced the pg session timezone to UTC via `options: "-c timezone=UTC"` in both Prisma clients.
- Verified all verify paths live (200, 404, 400, 410 used, 410 expired); test data cleaned up; typecheck + build pass.
- Implemented **login + session flow**: custom DB-backed sessions (replaced `express-session`/`connect-pg-simple` which wrote to the wrong `public` schema and didn't match docs). Session token stored as SHA-256 hash in `sessions.refresh_token_hash`; 30-day TTL (`ses_…` public id).
- `POST /api/v1/auth/login`: bcrypt verify, same 401 for unknown email vs wrong password, 403 for suspended/deleted; sets `session` cookie. `POST /register` now also creates a session + cookie (per docs).
- `GET /api/v1/auth/session` (auth) returns authenticated user + session info; `DELETE /api/v1/auth/session` revokes the session and clears the cookie.
- Rewrote `authentication` middleware: hash cookie → lookup session with user → reject revoked/expired/deactivated → `touchSession` → attach `req.userId`/`req.user`/`req.authSession`. `express-session` middleware removed from `app/index.ts`; `src/config/session.ts` deleted.
- Uninstalled `express-session`, `connect-pg-simple` and their type packages.
- Verified live: register→cookie→GET /session 200; no cookie 401; logout 204 + cookie cleared; revoked cookie 401; wrong password 401; valid login 200 + cookie; suspended user login 403 + existing session 401. Test data cleaned up; typecheck + build pass.
- Implemented **session-management endpoints** per `session-management.md`: `GET /auth/sessions` (all active sessions with `public_id`, `current`, `device`, `ip_address`, `last_activity_at`, `created_at`), `DELETE /auth/sessions/{session_public_id}` (revoke one, 404 if not owned/not found), `DELETE /auth/sessions` (revoke all except current). Revoking the current session also clears the cookie.
- Added dependency-free `parseDeviceName` UA parser (`"Chrome on Windows"`, `"Safari on iOS"`, …); `device_name` now stored at session creation; fallback to parsed/raw UA in the list.
- Verified live: 3 concurrent sessions listed with correct `current` flag + IP + device; revoke-specific 204 + removed from list; nonexistent session 404; other user's session 404 (no leak); logout-all keeps current session and kills others (401); revoking current session clears cookie; iPhone UA renders `"Safari on iOS"`. Test data cleaned up; typecheck + build pass.
- Implemented **`POST /auth/email-verification/resend`** per `email-verification.md`: auth-required, 409 if email already verified, otherwise invalidates previous unused tokens → issues a new token → queues email → **202 Accepted**. Added a stricter route-level rate limiter (5/15min). Extracted shared `issueVerificationToken` helper (now used by both `register` and `resend`).
- Verified live: 401 unauthenticated; 202 with cookie; DB shows prior tokens invalidated (`used_at`) and a fresh token issued on each resend; 409 once email verified. Test data cleaned up; typecheck + build pass.
- **Replaced pino with a custom JSON logger**: removed `pino`, `pino-pretty`, `pino-roll`; rewrote `src/shared/logger/index.ts` as a dependency-free logger that appends one JSON object per line to `logs/logs.json` (dir auto-created). Same `logger.info/error/warn/debug/trace/fatal` API so existing call sites (request middleware, error handler, startup, unhandled rejections, email failures) work unchanged. `LOG_LEVEL` filtering + Error serialization (`type`/`message`/`stack`); mirrors to console.
- Verified live: every operation (startup, health, register, session, login 401, resend 202) written to `logs/logs.json` as JSON lines; error/fatal/warn serialization verified; test data + test log noise cleaned up; typecheck + build pass.
- Attempted a Vitest + supertest integration-test setup for the auth module (separate `Ecommerce_test` schema + `db push` global setup, `.env.test`, mailer mock). Per user request the whole setup was removed again: test file, `src/test/`, `vitest.config.ts`, `.env.test`, and the `vitest`/`supertest`/`@types/supertest` dev deps all reverted; `npm test` is a stub again. Leftover empty `Ecommerce_test` schema dropped from the DB; `npm run typecheck` passes.

### Deliverables
- `src/modules/auth/{validators,repository,service,controller,routes,dto,index.ts}`
- `src/modules/auth/utils/tokens.ts` (generate + hash verification tokens)
- `src/shared/errors/GoneError.ts`
- `src/shared/mailer/index.ts` (Resend client + `sendEmail`), `src/shared/mailer/verification.ts` (`buildVerificationUrl` + `sendVerificationEmail`)
- `src/config/database.ts`, `lib/prisma.ts` (UTC session timezone fix)
- `src/middleware/validate.ts`, `src/middleware/authentication.ts`, `src/shared/types/express.d.ts`, `src/server.ts` fixed
- `PUBLIC_ID_PREFIXES.VERIFICATION: "vrf"` added
- `resend` dependency installed
- `src/modules/auth/validators/login.ts`, `dto/login.ts`, `types/context.ts`
- `src/modules/auth/utils/sessionCookie.ts` (set/clear `session` cookie), `src/shared/constants/session.ts` (`SESSION_COOKIE_NAME`, `SESSION_TTL_MS`), `PUBLIC_ID_PREFIXES.SESSION: "ses"`
- `auth.repository.ts` additions: `findUserByEmailWithCredentials`, `createSession`, `findSessionByTokenHash`, `touchSession`, `revokeSession`
- `src/modules/auth/utils/userAgent.ts` (`parseDeviceName`), `dto/session.ts` (`SessionInfo`/`ListSessionsResult`), `validators/sessionParams.ts`
- Session-management service + controllers: `listSessions`, `revokeSession`, `revokeAllOtherSessions`
- Repository additions: `findActiveSessionsByUser`, `findActiveSessionByPublicIdAndUser`, `revokeAllSessionsExcept`
- `resendVerificationEmail` service + controller; `issueVerificationToken` shared helper; `invalidateUnusedVerificationTokens` repository method
- `emailVerificationRateLimiter` (5 req / 15 min) in `src/middleware/rateLimiter.ts`
- Custom JSON logger in `src/shared/logger/index.ts` (writes `logs/logs.json`)

### Decisions
- Registration scope is minimal per user request: account creation only — email verification required for full features (docs flow partially deferred).
- Verification token is a 64-hex crypto random value; only its SHA-256 hash is stored (per `token_hash` column + single-use/expiry semantics). Token TTL 24h.
- Email delivery is real (Resend) and fire-and-forget: `sendVerificationEmail(...).catch(log)` — never blocks or fails registration, per `registration.md`.
- `RESEND_FROM_EMAIL` defaults to Resend's sandbox sender `onboarding@resend.dev`; switch to a verified domain for production.
- Verification link base URL is derived from `CORS_ORIGIN` (the client origin) until a dedicated app URL config exists.
- Verify is public (no session needed) and scoped to `purpose = REGISTER_EMAIL`; marking verified + invalidating token happen in one `$transaction` to preserve single-use semantics.
- pg session timezone forced to UTC for both Prisma clients so timestamptz round-trips correctly.
- Success responses use `{ success: true, data }` wrapper (consistent with the shared `ApiResponse`/error format), deviating slightly from the bare body in `registration.md`.
- Password policy enforced in the validator (8+ chars, upper/lower/number/special) → 400 via the shared validation middleware (docs mention 422 for policy).
- Prisma client generated into `src/generated` (standard v7 layout) so the whole program stays under `rootDir`.
- Sessions replaced `express-session`/`connect-pg-simple`: the scaffolder's store wrote to `public.user_sessions` and deviated from the docs (hash-only storage, revocation, `ses_…` ids). Session token is a 64-hex opaque value; only its SHA-256 hash is stored in `refresh_token_hash`. Cookie `session` is HttpOnly, SameSite=Lax, Secure in prod, Path=/.
- Registration starts a session too (matches `registration.md`), so a fresh register response carries the `session` cookie.
- Login returns the identical 401 message for unknown email and wrong password (no account enumeration); 403 for suspended/deleted accounts.
- Session TTL is 30 days absolute; `last_activity_at` is touched on every authenticated request (idle-timeout enforcement deferred).
- `device` in the sessions list is derived client-side from the UA via `parseDeviceName` (stored in `device_name` at creation); `current` is computed from the request's session, not the DB `is_current` column.
- Revoking a session not owned by the caller (or already revoked/expired) returns 404 to avoid leaking which sessions exist.
- Resend invalidates all prior unused `REGISTER_EMAIL` tokens (marking `used_at`) before issuing a new one, so old links return 410; dedicated 5/15min rate limiter per `email-verification.md` security notes.
- Logger emits JSON when stdout is not a TTY (e.g. redirected to a file / `server.log`); `pino-pretty` is only used on an interactive terminal.
- **Logging is custom + dependency-free**: all app logs (request logging, startup, errors, unhandled rejections) are appended as one JSON object per line to `logs/logs.json` (created on demand, `logs/` gitignored). Errors are serialized as `{ type, message, stack }`; level filtering via `LOG_LEVEL`; console mirrored.
- Prisma 7 `db push` no longer supports `--skip-generate` (unknown option) and supports a `--url` flag to override the datasource URL; relevant if a dedicated test DB is ever set up.

### Pending
- Idle-timeout enforcement via `last_activity_at` (e.g. auto-revoke after 30 days idle) not yet wired.
- Expired-session cleanup job (reject + delete expired sessions) not yet implemented.
- No test framework configured (`npm test` is a stub); the auth test suite was started and then reverted at user request.

### Next Step
- Choose the next module: users profile/addresses, or set up the test framework (`npm test` stub) to lock in auth behavior.
