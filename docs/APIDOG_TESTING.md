# Testing the API with Apidog

## 1. Overview

This document describes the complete workflow for testing this REST API with **Apidog** (an OpenAPI-first API testing tool, Postman-compatible scripting). It covers environment setup, session-cookie authentication, the request tree for every implemented endpoint, end-to-end test flows, assertions, and troubleshooting.

Scope: only **implemented** modules are documented — authentication, users, addresses, products (catalog + admin), and categories (catalog + admin). Cart, orders, inventory, payments, and reviews are not implemented yet, so their endpoints are out of scope.

The API contract is defined in `docs/API_DESIGN.md` and the per-module design docs under `docs/api/**`; those documents remain the source of truth. This guide only explains how to exercise that contract from Apidog.

---

## 2. Prerequisites

| Requirement | Detail |
|-------------|--------|
| Node.js 22 | Local dev runtime |
| PostgreSQL | Running locally with the schema migrated (`npm run db:migrate` or `db push`) |
| Environment | `.env` configured — `DATABASE_URL`, `SESSION_SECRET`, `CORS_ORIGIN`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `IMAGEKIT_*` (see `docs/TESTING.md` §17 for the full variable list) |
| Backend | `npm install` then `npm run dev` — boots on `http://localhost:3000` (`PORT` env overrides) |
| Apidog | Desktop app or web app (apidog.com) |

Verify the backend is up: `GET http://localhost:3000/health` → `200`.

---

## 3. Create an Apidog environment

Apidog → **Environments** → create environment **Local** and add the following variables:

| Variable | Value | Purpose |
|----------|-------|---------|
| `base_url` | `http://localhost:3000/api/v1` | Base for every request |
| `session_cookie` | *(empty)* | Filled by the login script (see §5) |
| `product_public_id` | *(empty)* | Captured from create/list responses |
| `category_public_id` | *(empty)* | Captured from create/list responses |
| `variant_public_id` | *(empty)* | Captured from create/list responses |
| `address_public_id` | *(empty)* | Captured from create/list responses |
| `session_public_id` | *(empty)* | Captured from the sessions list |
| `verification_token` | *(empty)* | From the verification email / DB (dev only) |

All paths below use `{{base_url}}` as a prefix, e.g. `{{base_url}}/products`.

---

## 4. Import the API contract

The project documents the contract in Markdown (`docs/API_DESIGN.md` + `docs/api/**`) and does **not** yet ship an OpenAPI file.

- **Option A — import an OpenAPI spec (recommended once available):** Apidog → **Import Data** → **OpenAPI/Swagger**. The design docs are written to be directly convertible to an OpenAPI 3.1 specification; generating one from `docs/api/**` is a planned follow-up.
- **Option B — build the request tree manually (works today):** create requests by hand following the endpoint tables in this document. Each module's design doc (`docs/api/products/products.md`, `docs/api/categories/categories.md`, …) contains the exact request/response schemas.

Tip: keep requests organized in a **collection** named after the API (e.g. `Ecommerce API`) with one folder per module, matching the layout in §6.

---

## 5. Authentication — session-based cookies

The API uses **server-side session cookies**. `POST /auth/register` and `POST /auth/login` respond with a `Set-Cookie: session=…` header (HttpOnly, SameSite=Lax, `Secure` in production). Every protected endpoint authenticates via that cookie. There are no API keys or bearer tokens.

### 5.1 Recommended: login script stores the cookie in an environment variable

1. Create request **Login**: `POST {{base_url}}/auth/login`
2. Body (raw JSON):
   ```json
   {
     "email": "your@email.com",
     "password": "StrongPassword123!"
   }
   ```
3. **Post-response script** (Apidog supports Postman's `pm.*` API):
   ```js
   const setCookie = pm.response.headers.get("set-cookie");
   const match = setCookie && setCookie.match(/session=([^;]+)/);
   if (match) {
     pm.environment.set("session_cookie", "session=" + match[1]);
   }
   ```
4. On every authenticated request, add the header:
   ```
   Cookie: {{session_cookie}}
   ```

Alternatively Apidog's built-in **cookie jar** can store cookies automatically (browser-like). It is simpler, but the explicit script above is deterministic and easy to debug.

### 5.2 Registration also starts a session

`POST /auth/register` creates an account **and** sets the session cookie, so a fresh registration is immediately usable for protected endpoints. See the register payload in §6.1.

### 5.3 Admin access

Admin endpoints require an authenticated session whose user has the `admin` role:

1. Register a user through the API (or reuse an existing account).
2. Promote it from the terminal:
   ```bash
   npm run admin:create
   ```
   Enter the user's email; the script reports `Current role: admin`.
3. Log in as that user in Apidog (cookie script from §5.1) — the session now has `admin` rights.

---

## 6. Request tree

### 6.1 Folder: `01 Auth`

| Method | Path | Auth | Expected | Notes |
|--------|------|------|----------|-------|
| POST | `{{base_url}}/auth/register` | – | 201 | Body: `first_name`, `last_name`, `phone_number` (E.164, e.g. `+15551234567`), `email`, `password` (≥8 chars, upper + lower + digit + special). Sets the session cookie. |
| POST | `{{base_url}}/auth/login` | – | 200 | Body: `email`, `password`. 401 for unknown email **or** wrong password (identical message — no enumeration). |
| GET | `{{base_url}}/auth/session` | cookie | 200 | Current session + user info |
| DELETE | `{{base_url}}/auth/session` | cookie | 204 | Logout; clears the cookie |
| GET | `{{base_url}}/auth/sessions` | cookie | 200 | All active sessions (`current` flag, device, IP) |
| DELETE | `{{base_url}}/auth/sessions/{session_public_id}` | cookie | 204 | Revoke one of **your own** sessions; 404 for other users' or unknown sessions |
| DELETE | `{{base_url}}/auth/sessions` | cookie | 204 | Revoke all other sessions |
| POST | `{{base_url}}/auth/email-verification/verify` | – | 200 | Body: `token` (from the emailed link). 404 unknown, 410 used/expired |
| POST | `{{base_url}}/auth/email-verification/resend` | cookie | 202 | 409 if email already verified; route rate limiter 5/15 min → 429 |

### 6.2 Folder: `02 Customer Catalog`

| Method | Path | Auth | Expected | Notes |
|--------|------|------|----------|-------|
| GET | `{{base_url}}/products` | – | 200 | Query: `page`, `limit` (≤100), `search`, `brand`, `sort` (`name`, `created_at`, `updated_at`, `-` prefix; default `-created_at`) |
| GET | `{{base_url}}/products/{product_public_id}` | – | 200 | 404 when no `ACTIVE` variant exists (product hidden) |
| GET | `{{base_url}}/categories` | – | 200 | Query: `page`, `limit`, `search`, `sort` (default `name` asc). Active + non-deleted only |
| GET | `{{base_url}}/categories/{category_public_id}` | – | 200 | Detail with `product_count` (customer-visible products) |
| GET | `{{base_url}}/categories/{category_public_id}/products` | – | 200 | Customer-visible products of the category; default sort `-created_at` |

### 6.3 Folder: `03 Account`

All requests carry the `Cookie: {{session_cookie}}` header.

| Method | Path | Expected | Notes |
|--------|------|----------|-------|
| GET | `{{base_url}}/users/me` | 200 | Profile |
| PATCH | `{{base_url}}/users/me` | 200 | Body: `first_name`, `last_name` only |
| DELETE | `{{base_url}}/users/me` | 204 | Body: `password`; soft-deletes account + revokes all sessions |
| PATCH | `{{base_url}}/users/me/password` | 204 | Body: `current_password`, `new_password`; rate limiter 5/15 min |
| POST | `{{base_url}}/users/me/email` | 202 | Body: `new_email`; sends verification email; rate limiter 5/15 min |
| POST | `{{base_url}}/users/me/email/verify` | 200 | Body: `token` |
| POST | `{{base_url}}/users/me/phone-number` | 202 | Body: `new_phone_number`; SMS stub logs the OTP; rate limiter 5/15 min |
| POST | `{{base_url}}/users/me/phone-number/verify` | 200 | Body: `otp` |
| GET | `{{base_url}}/users/me/addresses` | 200 | Paginated list |
| POST | `{{base_url}}/users/me/addresses` | 201 | Body per `docs/api/users/addresses.md` (`recipient_name`, `phone_number`, `country`, `state`, `city`, `address_1`, …) |
| GET | `{{base_url}}/users/me/addresses/{address_public_id}` | 200 | |
| PATCH | `{{base_url}}/users/me/addresses/{address_public_id}` | 200 | |
| DELETE | `{{base_url}}/users/me/addresses/{address_public_id}` | 204 | Soft delete |

### 6.4 Folder: `04 Admin`

All requests carry the `Cookie: {{session_cookie}}` header **and** require the `admin` role (see §5.3). Non-admin sessions get **403**.

| Method | Path | Expected | Notes |
|--------|------|----------|-------|
| GET | `{{base_url}}/admin/products` | 200 | Query incl. `include_deleted` |
| POST | `{{base_url}}/admin/products` | 201 | Body: `name` (required), `slug` (optional — auto-generated with `-2`/`-3`… suffixing), `description`, `brand`. 409 on duplicate slug |
| GET | `{{base_url}}/admin/products/{product_public_id}` | 200 | Admin detail with variants/images; query `include_deleted_variants` |
| PATCH | `{{base_url}}/admin/products/{product_public_id}` | 200 | Partial update |
| DELETE | `{{base_url}}/admin/products/{product_public_id}` | 204 | Soft-deletes product + variants in one transaction |
| GET | `{{base_url}}/admin/products/{product_public_id}/variants` | 200 | |
| POST | `{{base_url}}/admin/products/{product_public_id}/variants` | 201 | SKU globally unique → 409 |
| GET/PATCH/DELETE | `…/variants/{variant_public_id}` | 200/200/204 | |
| GET/POST/PATCH/DELETE | `…/images…` and `…/variants/…/images…` | 200/201/200/204 | Image URLs are ImageKit URLs; `is_primary` invariants |
| GET | `{{base_url}}/admin/products/uploads/imagekit-auth` | 200 | Returns `{ token, expire, signature, publicKey, urlEndpoint }` for client-side signed uploads |
| GET | `{{base_url}}/admin/categories` | 200 | Query: `page`, `limit`, `search`, `is_active` (`true`/`false`), `include_deleted`, `sort` |
| POST | `{{base_url}}/admin/categories` | 201 | Body: `slug`?, `name`, `description`?, `is_active`?; 409 `CATEGORY_NAME_TAKEN`/`CATEGORY_SLUG_TAKEN` |
| GET | `{{base_url}}/admin/categories/{category_public_id}` | 200 | Detail with `is_active` + admin `product_count` |
| PATCH | `{{base_url}}/admin/categories/{category_public_id}` | 200 | Partial; `description: null` clears; `is_active` toggle |
| DELETE | `{{base_url}}/admin/categories/{category_public_id}` | 204 | Soft-delete + removes `product_categories` links in one transaction |
| PUT | `{{base_url}}/admin/categories/{category_public_id}/products/{product_public_id}` | 204 | Idempotent assign (no-op if already linked) |
| DELETE | `{{base_url}}/admin/categories/{category_public_id}/products/{product_public_id}` | 204 | Idempotent unassign (no-op if not linked) |

---

## 7. Assertions

All responses use the shared envelope:

- Success (single): `{ "success": true, "data": { … } }`
- Success (list): `{ "success": true, "data": [ … ], "pagination": { "page", "limit", "total", "totalPages", "hasNext", "hasPrev" } }`
- Error: `{ "success": false, "message": "…" }` — validation failures also include an `errors` object

Never expect internal DB ids (`id`) or `deleted_at` in any payload; resources are identified by public IDs (`usr_…`, `prd_…`, `cat_…`, `var_…`, `pimg_…`, `vimg_…`, `adr_…`, `ses_…`, `vrf_…`).

Example **post-response script** for a list endpoint (Postman-compatible `pm.*`):

```js
// Status + envelope
pm.test("returns 200", () => pm.response.to.have.status(200));
pm.test("success flag is true", () => pm.expect(pm.response.json().success).to.be.true);

// Pagination metadata shape
const pagination = pm.response.json().pagination;
pm.test("pagination metadata present", () => {
  pm.expect(pagination).to.have.property("page");
  pm.expect(pagination).to.have.property("totalPages");
  pm.expect(pagination).to.have.property("hasNext");
});

// Payload hygiene: no internal id, no deleted_at
pm.test("no internal ids or deleted_at exposed", () => {
  const items = pm.response.json().data;
  for (const item of items) {
    pm.expect(item).to.not.have.property("id");
    pm.expect(item).to.not.have.property("deleted_at");
  }
});
```

Example for a create endpoint — **capture the generated public ID into an environment variable** for chained requests:

```js
pm.test("returns 201", () => pm.response.to.have.status(201));
pm.environment.set("product_public_id", pm.response.json().data.public_id);
```

---

## 8. End-to-end flows

Configure the **collection runner**: select the collection → **Run** → drag requests into order below (or rely on folder order). Apidog runs requests sequentially and shares the environment, so captured variables carry over.

### Flow A — Customer journey (no admin)

1. `POST /auth/register` (new user, random phone/email)
2. `GET /products` (empty or seeded list; capture `product_public_id` if any)
3. `GET /products/{product_public_id}` (product detail)
4. `GET /categories`
5. `GET /categories/{category_public_id}` (capture from step 4)
6. `GET /categories/{category_public_id}/products`
7. `GET /users/me` (session from registration is still valid)
8. `POST /users/me/addresses` (create a shipping address; capture `address_public_id`)
9. `DELETE /auth/session` (logout)

### Flow B — Admin content management

1. *(one-time, terminal)* `npm run admin:create` with an existing user's email
2. `POST /auth/login` as the admin user (cookie script fills `session_cookie`)
3. `POST /admin/products` (capture `product_public_id`)
4. `POST /admin/products/{product_public_id}/variants` (create an `ACTIVE` variant — required for customer visibility)
5. `GET /admin/products/uploads/imagekit-auth` (signed upload params)
6. `POST /admin/categories` (capture `category_public_id`)
7. `PUT /admin/categories/{category_public_id}/products/{product_public_id}` (assign; repeat → still 204, idempotent)
8. `GET /categories/{category_public_id}/products` (customer view now lists the product)
9. `GET /categories/{category_public_id}` (customer `product_count` reflects the assignment)
10. `PATCH /admin/categories/{category_public_id}` (`is_active: false`) → step 8 now **404s**
11. `PATCH /admin/categories/{category_public_id}` (`is_active: true`) → step 8 works again
12. `DELETE /admin/categories/{category_public_id}` (soft-delete; links removed; repeat → 404)
13. `DELETE /admin/products/{product_public_id}` (soft-delete)

### Flow C — Account security

1. `POST /auth/register`
2. `PATCH /users/me/password` (change password)
3. `POST /auth/login` with the **new** password (old sessions revoked — old cookie now 401)
4. `POST /users/me/email` (rate-limited; 202)
5. `POST /auth/sessions` → list, capture a `session_public_id` other than the current one
6. `DELETE /auth/sessions/{session_public_id}` (revoke another session)
7. `DELETE /users/me` (delete account; cookie is cleared)

---

## 9. Rate limiting

- Route-level limiters apply **5 requests / 15 minutes** per user to: `POST /auth/email-verification/resend`, `PATCH /users/me/password`, `POST /users/me/email`, `POST /users/me/phone-number`. Exceeding them returns **429**.
- The global API rate limiter is skipped only when `NODE_ENV=test`; under `npm run dev` it is active.
- When re-running flows, either pace requests or use fresh test users (registration is not rate-limited by these rules).

---

## 10. Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| 400 with `errors` | Validation failed. Check the message details: E.164 phone (`+1…`), password policy, slug regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`, name/limit constraints |
| 401 | No session cookie, expired/revoked session, or deactivated account → run Login again (or Register) to refresh `session_cookie` |
| 403 | Authenticated but not `admin` → promote via `npm run admin:create` |
| 404 | Unknown public ID, **or** an intentionally hidden resource (inactive/soft-deleted category or a product without an `ACTIVE` variant) — the API does not reveal existence |
| 409 | Duplicate `name`/`slug` (categories), `slug`/SKU (products), or email/phone (auth/users) |
| 429 | Route rate limiter exceeded → wait 15 min or use a fresh account |
| 500 | Server error — check `logs/log.json`; do not rely on the response body for internals |
| Cookie not sent | Confirm the request actually carries `Cookie: {{session_cookie}}` (or the cookie jar is enabled); the value must be `session=<token>` |
| Timestamps look shifted | The API returns ISO 8601 UTC; the local pg session is forced to UTC |

---

## 11. Notes

- **CSRF:** `csrf-csrf` is installed but **not yet wired** into the request pipeline, so no CSRF token header is required today. If CSRF middleware is added, cookie-authenticated writes will need the documented fetch/validate token flow; revisit this guide then.
- **Email/OTP tokens in dev:** verification links and the SMS OTP are delivered by real services (Resend) or the SMS stub (logs only). For local testing, read the pending token from the `verification_tokens` table or use the backend-served verify pages (`/verify-email?token=…`, `/verify-email-change?token=…`).
- **Email verification is not required** for the flows in this guide: customer browsing and admin operations work with a fresh unverified account.
- **ImageKit:** image URLs in product/variant image payloads must be absolute http/https URLs (validated). The API never receives file bytes — clients upload to ImageKit using the signed params from `GET /admin/products/uploads/imagekit-auth` and then store the returned URL.
- **OpenAPI import (follow-up):** generating an OpenAPI 3.1 specification from `docs/api/**` would make Apidog setup one-click (Import → OpenAPI/Swagger). The design docs are written to be directly convertible, per `docs/API_DESIGN.md`.
- The API contract (endpoints, fields, error semantics) is defined in `docs/API_DESIGN.md` and the per-module docs under `docs/api/**` — when in doubt, those are the source of truth.
