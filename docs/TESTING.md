# TESTING.md

# Testing Strategy

> This document is the source of truth for the project's testing strategy. It is written for future AI agents and developers working on this ecommerce REST API. Read it before adding, changing, or running tests.

---

# 1. Testing Goals and Principles

The purpose of testing here is to give confidence that the API behaves as documented — not to make CI green by weakening coverage.

- **Verify behavior and API contracts, not implementation details.** Assert on request/response behavior (status codes, body shape, cookie behavior) and business outcomes (what persisted), not on which internal functions were called.
- **Every layer gets the right kind of test.** Pure logic (validators, helpers, business rules) is unit-tested; repository + service behavior against a real Postgres database is integration-tested; the HTTP surface is exercised end-to-end through the Express app.
- **Isolation is mandatory.** No test may depend on state created by another test, on a shared mutable database, or on production data.
- **External services are mocked/stubbed.** Email, payments, storage, and third-party APIs are replaced unless a test intentionally exercises a real integration.
- **Tests are part of the feature.** A change is not complete until its tests are added or updated (see AGENTS.md Definition of Done).
- **Never weaken, delete, skip, or disable a test just to make CI pass.** If a test is wrong, fix the test or the code — do not `skip`/`only`/`todo` it into silence.
- **Never touch `.github/workflows/` with test logic.** CI runs tests; the test runner discovers them. See section 18.

---

# 2. Current Testing Stack

The suite is fully installed and running. Use exactly one runner so the whole suite runs from one command — do not introduce a second one (e.g., no Jest alongside Vitest):

- **Vitest 4** as the test runner (native TypeScript/ESM support; `"type": "module"` in `package.json` requires a runner that handles ESM natively).
- **supertest** against the Express `app` for HTTP-level integration/API tests (works with the exported `app` from `src/app/index.ts`; no server port needed).
- **@vitest/coverage-v8** for the `test:coverage` script.
- **dotenv** loads `.env.test` before the suite starts (`vitest.config.ts` + `tests/setup/env.setup.ts`).

Current state (as of this writing):

- 35 test files across `tests/unit`, `tests/integration`, and `tests/e2e`; the full suite (396 tests) passes via `npm test`.
- `ci.yml` runs `npm test` after typecheck, build, and test-database setup (see section 18).
- The project has `tsx` already; if a standalone script or a specific test needs `tsx`, that is fine, but the suite runs through Vitest.

---

# 3. Unit Testing

Targets: pure logic that has no I/O.

- Validators (`src/modules/<module>/validators/*`): feed valid/invalid shapes; assert accepted values and 400-style rejection messages via the shared validation middleware or the validator function directly.
- Helpers/utils (`src/modules/*/utils/*`, `src/shared/utils/*`): e.g. token generation/hashing, OTP helpers, `parseDeviceName`, pagination helpers.
- Business rules that can run without a database: e.g. password policy checks, price/total calculations, "new password equals current" rejection.
- Services should be tested here **only when** their dependencies (repositories) are mocked; anything touching Prisma belongs in integration tests (section 4).

Unit tests must not hit the network, the filesystem, or the database.

---

# 4. Integration Testing

Targets: repository queries and service business logic against a **real** Postgres database.

- Repository tests: each query method against a dedicated test schema — CRUD, ownership filters (`users_id`, `deleted_at: null`), public-ID lookups, pagination.
- Service tests: full business flows with the real repository inside, e.g. `register`, `login`, `changePassword` (revokes other sessions), email/phone change (token invalidation, 404/400/410 semantics), checkout-style `$transaction` flows (all-or-nothing commit/rollback).
- These tests create their own rows through factories (section 11) and clean up between tests (section 12).

---

# 5. API/E2E Testing

Targets: the HTTP surface through `supertest(app)`.

- Full request → response cycles: status code, `{ success, data }` envelope, headers, cookies.
- Middleware behavior: rate limiting (429), session authentication (401 without cookie), CSRF/helmet headers.
- Documented status semantics per `docs/api/*`: 200/201/202/204, 400 validation, 401 unauthenticated, 403 forbidden/suspended, 404 not found/not owned, 409 conflict, 410 gone/expired.
- No internal IDs leak: assert response bodies never contain DB primary keys (`id`), only public IDs (`public_id` with documented prefixes like `usr_`, `ses_`, `vrf_`, `adr_`).

---

# 6. Test Directory Structure

Tests live **outside** `src/`. Reason: `tsconfig.json` uses `"include": ["src/**/*"]` and `"rootDir": "./src"`, so test files placed under `src/` would be compiled by `npm run build` into `dist/`. A top-level `tests/` directory keeps the build output clean.

Recommended layout (mirrors `src/` so test ↔ source correspondence is obvious):

```
tests/
├── unit/                    # validators, utils, pure service rules
│   ├── auth/
│   ├── users/
│   ├── addresses/
│   └── products/
├── integration/             # repository + service against the test DB
│   ├── auth/
│   ├── users/
│   ├── addresses/
│   └── products/
├── e2e/                     # supertest endpoint suites
│   ├── auth/
│   ├── users/
│   ├── addresses/
│   └── products/
├── factories/               # row factories (section 11)
├── helpers/                 # auth cookie helpers, DB cleanup, random, image URLs
└── setup/
    └── env.setup.ts         # loads .env.test and forces NODE_ENV=test
```

This is a recommendation; if a module co-locates unit tests inside its folder, keep them clearly named and ensure the Vitest include glob (section 9) picks them up and `tsconfig` excludes them.

---

# 7. Test File Naming Conventions

- Unit tests: `<subject>.test.ts` — e.g. `login.validator.test.ts`, `tokens.test.ts`.
- Integration tests: `<subject>.integration.test.ts` — e.g. `auth.service.integration.test.ts`.
- API/E2E tests: `<endpoint>.api.test.ts` — e.g. `users.me.api.test.ts`, `image-upload.api.test.ts`.

The `.integration.` and `.api.` suffixes let Vitest include globs target them separately from unit tests (section 9).

---

# 8. Test Discovery

- **The test runner discovers test files.** Vitest discovers files matching its `include` globs recursively — no central registry of test files exists. Current `include` globs (`vitest.config.ts`):
  - unit: `tests/unit/**/*.test.ts`
  - integration: `tests/integration/**/*.integration.test.ts`
  - e2e/API: `tests/e2e/**/*.api.test.ts`
- `npm test` runs the whole suite through the runner. **CI must not list individual test files** (section 18).
- **Adding a new test normally requires no modification to `ci.yml`.** Just create the file under `tests/` with a matching name; the runner and CI pick it up automatically.

---

# 9. Package Scripts

Current scripts (from `package.json`):

- `npm test` → `vitest run` — the full suite; the single command CI invokes.
- `npm run test:watch` → `vitest` — watch mode during development.
- `npm run test:integration` → `vitest run tests/integration` — integration tests only.
- `npm run test:e2e` → `vitest run tests/e2e` — API/e2e tests only.
- `npm run test:coverage` → `vitest run --coverage` — full suite with coverage (uses `@vitest/coverage-v8`).

`npm test` must remain the single command CI invokes (section 18).

---

# 10. Database Testing with PostgreSQL/Prisma

- **Never run integration tests against the production/dev database.** Tests use the `Ecommerce_DB` database's `Ecommerce` schema locally and a dedicated Postgres database in CI (`ecommerce_test`).
- The project uses Prisma 7 with `@prisma/adapter-pg`. Notes that affect testing:
  - `prisma db push` supports a `--url` flag to override the datasource URL — CI uses it to prepare the test database. (`--skip-generate` is **not** supported in Prisma 7; `prisma generate` runs separately.)
  - Both Prisma clients force the pg session timezone to UTC (`options: "-c timezone=UTC"`). Any test-created Prisma client must do the same so timestamptz comparisons (token expiry, session TTL) behave identically in tests.
- **Schema setup:** prepared before the suite runs via `prisma db push` (CI does this in the "Prepare test database" step). There is no in-suite migration step.
- **Time-dependent logic:** token/OTP expiry, session TTL, and idle-timeout are expressed in milliseconds from constants (`VERIFICATION_TOKEN_TTL_MS`, `PHONE_OTP_TTL_MS`, `SESSION_TTL_MS`). Where a test needs an "expired" row, insert/update rows with past timestamps directly rather than mocking `Date.now()` unless the mock is unavoidable.
- **Transactions:** services own `prisma.$transaction`. Integration tests must verify both the commit path (all writes persist) and the rollback path (a failing step leaves no partial rows) for flows like checkout and delete-account.
- The Prisma client used by tests is the same client the app configures (`src/config/database.ts`); reuse it rather than constructing a separate test client.

---

# 11. Test Data, Fixtures, and Factories

- Prefer **factory functions** over hand-written rows. Each factory lives in `tests/factories/` and creates a minimal valid row for one model, accepting overrides: e.g. `createUser({ email: "x@example.com" })`, `createSessionForUser(user)`.
- **Uniqueness:** use `nanoid` (already a dependency, used for public IDs) to generate unique emails/phones/names so parallel or repeated runs never collide — e.g. `test-${nanoid(8)}@example.com`.
- Passwords: factories hash with the same `bcrypt` usage the app uses; tests that need a known password keep it in a constant and pass it through.
- Fixtures that are shared across files go in `tests/helpers/`; per-test variation goes through factory overrides.
- Do not pull in a fake-data library (faker, chance) unless it is added deliberately as a dependency.

---

# 12. Test Isolation and Cleanup

- **Clean between tests.** `tests/helpers/db.ts` exports `cleanupTestData()`, which deletes every row whose user email starts with `test-` (users, plus their verification tokens, sessions, and addresses) and all product rows (`product_variant_images`, `product_variants`, `product_images`, `products`). Integration/e2e suites call it in `beforeEach`/`afterAll` so no state leaks across tests.
- **Unique emails/phones guarantee safe cleanup:** factories generate emails prefixed with `test-` (see section 11), so any leftover rows from a failed run are caught by `cleanupTestData()`.
- Tests must not depend on insertion order or on rows created by an earlier test.
- Logs: tests must not write into the project's `logs/` directory; silence the logger in the test env (`NODE_ENV=test`) or point it at a no-op.

---

# 13. Authentication / Session Testing

Auth is session-based. The cookie name is `session` (HttpOnly; `SESSION_COOKIE_NAME` in `src/shared/constants/session.ts`). Session token is stored as a SHA-256 hash in `sessions.refresh_token_hash`; the `authentication` middleware hashes the cookie and looks up the session.

How to test:

- **Public vs protected:** assert protected endpoints return 401 with no cookie and 2xx/3xx with a valid cookie.
- **Cookie round-trip with supertest:**
  - Capture the cookie from a login/register response: `const cookies = res.headers['set-cookie']`.
  - Replay it on subsequent requests: `.set('Cookie', cookies)` (or extract the `session=…` pair).
- **Seeding a session directly:** for middleware/repository-level tests, insert a session row via the auth repository/factory (hashed token + matching `SESSION_TTL_MS`), then set the cookie to the raw token value.
- **Session lifecycle:** register/logout clears the cookie; revoking a session returns 401 on the next use of that cookie; password change revokes other sessions while keeping the current one; deleting the account revokes all sessions.
- **CSRF:** the app uses `csrf-csrf`. API tests that exercise cookie-authenticated writes must replicate the CSRF flow (fetch/validate token pair) exactly as the docs describe; do not disable CSRF in tests.

---

# 14. API Contract Testing

The API contract is defined in `docs/API_DESIGN.md` and the per-resource docs under `docs/api/`. Tests are the executable form of that contract.

Assert, for each endpoint:

- **Response envelope:** `{ success: true, data }` for success; `{ success: false, ... }` for errors; `PaginatedResponse` shape (`success`, `data`, `pagination`) where documented.
- **Status codes:** exactly the documented ones for happy path and each documented error (see section 5).
- **Public IDs only:** `public_id` fields present and prefixed correctly (`usr_`, `ses_`, `vrf_`, `adr_`); internal numeric `id` keys never appear in any response body.
- **Field names/shapes:** snake_case keys as documented; correct nullability (e.g. `email_verified` vs `email_verified_at`).
- **Pagination/filtering/sorting:** where documented, assert page params, ordering, and totals.

Do not assert on response formatting implementation details (e.g. exact JSON key order, logger output).

---

# 15. Error / Validation Testing

The API has centralized validation (`src/middleware/validate.ts`) and a global error handler (`src/middleware/errorHandler.ts`) with shared error classes mapping to statuses:

- `BadRequestError` → 400
- `UnauthorizedError` → 401
- `ForbiddenError` → 403
- `NotFoundError` → 404
- `ConflictError` → 409
- `GoneError` → 410

For each validator: invalid/missing/malformed input → 400 with a meaningful message and no partial writes.

For each business-rule error path: assert the exact documented status — e.g. change-phone distinguishes 404 (no pending request), 400 (invalid OTP), 410 (used/expired); login returns the same 401 for unknown email and wrong password (no account enumeration); revoked/nonexistent sessions return 404 (no leakage).

**Error handler must never leak internals:** assert that 500 responses (forced by a stubbed repository failure) contain no stack traces, SQL, or error messages from internal exceptions.

---

# 16. External Service Mocking

- **Email (Resend):** the mailer module (`src/shared/mailer/index.ts`) constructs its client at import time from `env.RESEND_API_KEY`. Tests must either mock the module (`vi.mock`) at the boundary or provide a valid-looking dummy key in `.env.test`. Services send email fire-and-forget (`sendEmail(...).catch(log)`); never assert that a real email was delivered — assert the side effects (token row, response status) instead, and where relevant that the mailer was called with the right recipient/subject.
- **SMS:** the project ships an SMS dev stub (`src/shared/sms/index.ts`) that logs the OTP instead of sending. Use it in tests; swap in the mocked interface when the stub is replaced by a real provider.
- **ImageKit:** the SDK client (`src/shared/imagekit/client.ts`) is constructed from `IMAGEKIT_*` env vars. Auth-params generation is pure HMAC (no network); tests assert the endpoint returns `{ token, expire, signature, publicKey, urlEndpoint }` without calling ImageKit. Never upload or hit the real ImageKit service in tests — the dummy keys in `.env.test` fail any real request, which is intentional.
- **Payments:** the payment module uses a mock provider. Mock the provider boundary; test the business flow (order state transitions, payment completion transaction) without a real gateway.
- **Other third parties:** mock at the module/interface boundary using the runner's mocking (e.g. `vi.mock`), never by pointing tests at a live service.
- Only an explicitly intentional integration test (clearly marked, e.g. tagged and excluded from the default `npm test` run) may hit a real external service.

---

# 17. Environment Variables and Test Configuration

The env schema (`src/config/env.ts`) is validated by zod and calls `process.exit(1)` on failure. Any test run must satisfy:

- `DATABASE_URL` (local: the `Ecommerce_DB` database's `Ecommerce` schema)
- `SESSION_SECRET` (≥16 chars)
- `CORS_ORIGIN`
- `RESEND_API_KEY` (non-empty; use a dummy value)
- `RESEND_FROM_EMAIL` (optional, defaults to `onboarding@resend.dev`)
- `IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY`, `IMAGEKIT_URL_ENDPOINT` (dummy values; real requests must fail in tests)
- `PORT`, `NODE_ENV`

Current setup:

- `.env.test` holds the test env (gitignored): `NODE_ENV=test`, the local `DATABASE_URL`, dummy `RESEND_API_KEY`/`IMAGEKIT_*` keys, a test `SESSION_SECRET`, and `CORS_ORIGIN` for the test client.
- `vitest.config.ts` runs `dotenv.config({ path: ".env.test" })` and `tests/setup/env.setup.ts` forces `NODE_ENV=test`.
- `.env.test.example` is committed and documents every test variable so CI and new developers can reproduce the test env.
- `NODE_ENV=test` drives test-only behavior (e.g. silent logger, disabled external calls) — prefer gating on `env.NODE_ENV === "test"` over ad-hoc flags.

---

# 18. CI Behavior

`.github/workflows/ci.yml` is the single CI entry point. Its contract:

- It **runs** the suite by invoking a single command: `npm test` (which runs the full Vitest suite).
- The **test runner discovers** the test files (section 8). `ci.yml` must never enumerate or glob individual test files, and no test file ever lives under `.github/workflows/`.
- **Adding a new test normally requires no change to `ci.yml`** — create the file under `tests/` with a proper name and it is discovered automatically.
- **Adding a new dev/test dependency** (e.g. `vitest`, `supertest`) is the only situation that legitimately touches CI: the `npm ci` step in `ci.yml` must run after the dependency lands, and only `package.json`/`package-lock.json` changes are expected — never test-file lists.

Current CI pipeline (in order): checkout → setup Node (matrix: 20, 22) → `npm ci` → `npx prisma generate` → `npm run typecheck` → `npm run build` → **"Prepare test database"** (`npx prisma db push --url "$DATABASE_URL" --accept-data-loss` against the `postgres:16` service) → **"Create test environment file"** (writes `.env.test` from GitHub secrets; see below) → **"Test"** (`npm test`).

CI uses a dedicated Postgres database (`ecommerce_test`) provisioned as a GitHub Actions service container; it never touches a shared or production database.

---

# 18.1 CI Secrets and Environment Variables

Never commit real secrets. Use the committed `.env.test.example` to document which variables exist and what they are for — the values themselves stay in the developer's local `.env.test` (gitignored) and in GitHub.

When a secret is required in GitHub Actions, it must be configured as a **GitHub Repository Secret** under **Settings → Secrets and variables → Actions**. The CI workflow (`ci.yml`) maps those secrets into the test environment file; if a secret is missing, the workflow fails.

**GitHub Repository Secrets required by `ci.yml`:**

- `SESSION_SECRET` — ≥16 chars; used to sign session cookies in tests.
- `RESEND_API_KEY` — dummy/throwaway key; must be non-empty (the mailer client is built at import time).
- `RESEND_FROM_EMAIL` — the "from" address used in test emails.
- `IMAGEKIT_PUBLIC_KEY` — ImageKit public key (needed for the auth-params endpoint contract).
- `IMAGEKIT_PRIVATE_KEY` — ImageKit private key. **Never log or expose it**; it is only used to build HMAC signatures.
- `IMAGEKIT_URL_ENDPOINT` — the ImageKit delivery endpoint.

**Environment variables that are NOT secrets** and may stay inline in `ci.yml`:

- `DATABASE_URL` — set inline to the CI Postgres service connection string (a throwaway DB created per run; no secret).
- `CORS_ORIGIN` — inline (`http://localhost:3000`).
- `NODE_ENV` — set to `test` in the generated `.env.test`.

CI writes these into a generated `.env.test` file (never committed) before running `npm test`. Local developers reproduce the same environment by copying `.env.test.example` to `.env.test` and filling in values. Reporting requirement: if you change which secrets CI needs, update the lists above and the `Create test environment file` step together — and tell the maintainer which GitHub secrets must be configured.

---

# 19. What Must Be Tested When Adding a New Feature

For every new endpoint or feature, add coverage for:

1. **Validators:** valid input accepted; each invalid/missing field → 400.
2. **Service happy path:** the documented success outcome (status, response data, DB rows created/updated/deleted).
3. **Every documented error path:** each status the endpoint can return (401/403/404/409/410), with the exact preconditions (not owned, already used, expired, suspended, conflict).
4. **Ownership/scoping:** a second user cannot read/write the first user's resources (404, no leak).
5. **Transactions:** multi-write flows commit atomically and roll back cleanly on failure.
6. **Auth boundary:** public vs authenticated; correct cookie behavior.
7. **Security contract:** public IDs only, no internal IDs leaked; validation errors are generic; no internals in 500s.
8. **Rate limiting:** if the endpoint uses a dedicated limiter (e.g. `emailVerificationRateLimiter`, `passwordChangeRateLimiter`), assert 429 after the documented limit.
9. **API docs alignment:** the tests assert exactly what `docs/api/<resource>/*.md` documents (status codes, envelope, field names).

---

# 20. Rules for Agents When Creating or Modifying Tests

- Add tests with the feature; never commit a feature without its tests.
- Use the project's single test runner — never introduce a second framework.
- Place files under `tests/` with the naming in section 7; never inside `.github/workflows/`.
- Assert behavior and contracts, not implementation details or internals.
- Never `skip`, `todo`, `only`/`it.only`, or `@ts-ignore` tests to make CI pass. If you must debug, remove the `only`/`skip` before committing.
- Never delete or weaken an existing test to pass CI. If a test is wrong, correct the assertion or the code, then verify it passes for the right reason.
- Never use production or development data in tests; always the dedicated test schema.
- Mock external services at their boundaries (section 16).
- Keep tests deterministic: no sleeps/timing assumptions, no reliance on real time except seeded past/future timestamps, no shared mutable state.
- Clean up after yourself: truncate tables, restore mocks, and reset any env your test mutated.
- `npm run typecheck` must still pass after adding tests (if tests are outside `src/`, ensure they are still covered by the runner's typechecking, e.g. Vitest's native TS handling).

---

# 21. Definition of Done for Testing

A feature is testing-complete only when:

- Unit tests cover validators, pure helpers, and mockable service rules.
- Integration tests cover repository queries and service business flows against the test Postgres schema, including transaction rollback where applicable.
- API tests cover the happy path and every documented error status, the response envelope, and the no-internal-ID rule.
- Auth/session behavior (public vs protected, cookie round-trip, revocation) is covered for authenticated endpoints.
- External services are mocked; no test depends on a live email/SMS/payment provider.
- Tests are auto-discovered; adding them required no change to `ci.yml`.
- The full suite passes via `npm test`, and `npm run typecheck` + `npm run build` pass.
- No `skip`/`only`/disabled tests are committed.
- Test data is isolated to the test schema and cleaned up between tests.

---

# Summary

The API is tested with **Vitest 4 + supertest** as a single stack: unit tests for pure logic, integration tests against the real Postgres schema (reusing the app's Prisma client), and e2e/API tests through `supertest(app)`. Tests live in a top-level `tests/` directory discovered by the runner, external services (Resend, SMS, ImageKit, payments) are mocked or use dummy keys, and `cleanupTestData()` isolates the test schema between runs. The `ci.yml` pipeline prepares a dedicated Postgres database, writes `.env.test` from GitHub secrets (see section 18.1), and runs the full suite via `npm test`. Tests are the executable contract for `docs/api/*` and must never be weakened to satisfy CI.
