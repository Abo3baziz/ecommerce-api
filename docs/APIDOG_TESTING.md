# Testing the API with Apidog

## 1. Overview

This document describes the complete workflow for testing this REST API with **Apidog** (an OpenAPI-first API testing tool, Postman-compatible scripting). It covers environment setup, session-cookie authentication, the request tree for every implemented endpoint, end-to-end test flows, assertions, and troubleshooting.

Scope: all **implemented** modules are documented — authentication, users (profile + admin customer management), addresses, products (catalog + admin), categories (catalog + admin), cart, orders (customer + admin), inventory (admin), and reviews (public + customer + admin). Payments have no standalone surface; they are exercised only through the order `payment_method: "mock"` (see §6.6).

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
| `user_public_id` | *(empty)* | Captured from admin customer list/detail responses |
| `order_public_id` | *(empty)* | Captured from place-order/order-list responses |
| `review_public_id` | *(empty)* | Captured from review create/list responses |

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

Admin endpoints require an authenticated session whose user has the `admin` or `super_admin` role:

1. Register a user through the API (or reuse an existing account).
2. Promote it from the terminal:
   ```bash
   npm run admin:create
   ```
   Enter the user's email; the **first promoted user** becomes `SUPER_ADMIN` (the script reports `Current role: SUPER_ADMIN`), and every later promotion becomes `ADMIN`.
3. Log in as that user in Apidog (cookie script from §5.1) — the session now has admin rights.

Only `SUPER_ADMIN` sessions can call the role endpoint (`PATCH /admin/users/{user_public_id}/role`); regular `ADMIN` sessions get **403** on it but can use the rest of the Admin folder.

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
| POST | `{{base_url}}/auth/password-reset` | – | 202 | Body: `email`. Always returns the same message (no account enumeration); route rate limiter 5/15 min → 429 |
| POST | `{{base_url}}/auth/password-reset/verify` | – | 204 | Body: `token`, `new_password` (password policy). 404 unknown token, 410 used/expired; revokes **all** sessions |

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
| GET | `{{base_url}}/admin/users` | 200 | Customers only (`role` `CUSTOMER`); query `page`, `limit`, `search`, `status`, `include_deleted`, `sort` (`name`/`email`/`created_at`, `-` prefix; default `-created_at`) |
| GET | `{{base_url}}/admin/users/{user_public_id}` | 200 | Single customer; 404 for admins/unknown/deleted |
| PATCH | `{{base_url}}/admin/users/{user_public_id}` | 200 | Body: `first_name`?, `last_name`?, `email`?, `phone_number`? (E.164); 409 on email/phone already used |
| PATCH | `{{base_url}}/admin/users/{user_public_id}/suspend` | 200 | Suspends + revokes all sessions; 400 if already suspended |
| PATCH | `{{base_url}}/admin/users/{user_public_id}/activate` | 200 | 400 if already active |
| PATCH | `{{base_url}}/admin/users/{user_public_id}/role` | 200 | Body: `role` `ADMIN`/`CUSTOMER` (not `SUPER_ADMIN`). **Super admin only** — regular admins get 403. 400 self-role-change; 404 unknown user; 409 demoting the last admin-privileged user; no-op → 200 idempotent |

### 6.5 Folder: `05 Cart`

All requests carry the `Cookie: {{session_cookie}}` header. Cart operations require an `ACTIVE` variant of a product; a non-purchasable variant → 404.

| Method | Path | Expected | Notes |
|--------|------|----------|-------|
| GET | `{{base_url}}/cart` | 200 | 404 until a cart exists (the cart is created **lazily** on first add). Cart Object: `public_id` (`crt_…`), `items_count`, `total_quantity`, `subtotal`, `items[]`, `created_at`, `updated_at` |
| POST | `{{base_url}}/cart/items` | 200 | Body: `variant_public_id` (required), `quantity` (optional, default 1, 1–999). Adds to an existing line (merge semantics); 400 if the merged quantity would exceed 999 |
| PATCH | `{{base_url}}/cart/items/{variant_public_id}` | 200 | Body: `quantity` (required, **absolute** set, 1–999) |
| DELETE | `{{base_url}}/cart/items/{variant_public_id}` | 204 | Removes the line |
| DELETE | `{{base_url}}/cart` | 204 | Deletes the cart row; a following `GET /cart` returns 404 |

### 6.6 Folder: `06 Orders`

All requests carry the `Cookie: {{session_cookie}}` header.

| Method | Path | Expected | Notes |
|--------|------|----------|-------|
| POST | `{{base_url}}/orders` | 201 | Checkout. Body: `address_public_id` (required), `payment_method` (`"mock"` — the only value in v1), `coupon_code`? (≤50), `notes`? (≤1000). 404 when there is no cart or address; 409 on empty cart, non-purchasable item, insufficient stock, or invalid coupon. Mock payment succeeds inline, so new orders are created **`confirmed`** |
| GET | `{{base_url}}/orders` | 200 | Query: `page`, `limit`, `status` (`pending`/`confirmed`/`processing`/`shipped`/`delivered`/`cancelled`/`returned`/`refunded`), `sort` (`placed_at`, `order_number`, `total_amount`, `-` prefix; default `-placed_at`) |
| GET | `{{base_url}}/orders/{order_public_id}` | 200 | Order detail: `order_number` (`ORD-…`), `status`, `placed_at`, `subtotal`, `discount_amount`, `shipping_fee`, `tax_amount`, `total_amount`, `shipping_address`, `payment`, `items[]`. 404 for unknown **or** foreign orders |

### 6.7 Folder: `07 Admin Orders`

All requests carry the `Cookie: {{session_cookie}}` header **and** require the `admin` role (see §5.3).

| Method | Path | Expected | Notes |
|--------|------|----------|-------|
| GET | `{{base_url}}/admin/orders` | 200 | Query: `page`, `limit`, `status`, `search` (order number / customer name / email), `placed_from` + `placed_to` (ISO datetime; `from ≤ to`), `sort` (`placed_at`, `order_number`, `total_amount`, `customer_name`, `-` prefix; default `-placed_at`). Rows are lighter (no `items`/`payment`) and include `customer_public_id`/`customer_name`/`customer_email` |
| GET | `{{base_url}}/admin/orders/{order_public_id}` | 200 | Full admin projection + `shipment` + customer summary |
| PATCH | `{{base_url}}/admin/orders/{order_public_id}` | 200 | Body: `status` (required), `carrier` (required when transitioning to `shipped`, ≤100), `tracking_number`? (≤100). Legal transitions: `pending → confirmed/cancelled`, `confirmed → processing/cancelled`, `processing → shipped/cancelled`, `shipped → delivered`, `delivered → returned`, `returned → refunded`. 409 for illegal or same-status (no-op) transitions |

### 6.8 Folder: `08 Admin Inventory`

All requests carry the `Cookie: {{session_cookie}}` header **and** require the `admin` role (see §5.3). Inventory is keyed by `variant_public_id` — there is no separate inventory public ID.

| Method | Path | Expected | Notes |
|--------|------|----------|-------|
| GET | `{{base_url}}/admin/inventory` | 200 | Query: `page`, `limit`, `search` (SKU/barcode/product name), `stock_status` (`IN_STOCK`/`LOW_STOCK`/`OUT_OF_STOCK`), `include_deleted`, `sort` (`product_name`, `sku`, `quantity_on_hand`, `quantity_available`, `last_stock_update`; default `product_name` asc). Fields: `product_public_id`, `product_name`, `sku`, `barcode`, `quantity_on_hand`, `quantity_reserved` (read-only), `quantity_available`, `reorder_level`, `stock_status` |
| POST | `{{base_url}}/admin/inventory` | 201 | Body: `variant_public_id` (required), `quantity_on_hand` (required, ≥0), `reorder_level`? (≥0). 409 if an inventory record already exists for the variant |
| GET | `{{base_url}}/admin/inventory/{variant_public_id}` | 200 | 404 if no record exists (or the variant is soft-deleted) |
| PATCH | `{{base_url}}/admin/inventory/{variant_public_id}` | 200 | Body: `quantity_on_hand` (absolute, ≥0) **XOR** `quantity_change` (non-zero signed delta), `reorder_level` (`null` clears), `reason`? (≤255, audit-logged only). 400 if both quantity fields are sent or none is; 409 if a delta drives stock below zero |

### 6.9 Folder: `09 Reviews`

Public rows need **no** session; customer rows carry the `Cookie: {{session_cookie}}` header. Reviews are auto-approved on creation (`is_approved` defaults `true`), so a new review is immediately visible to the public. `REVIEWS_REQUIRE_PURCHASE` is disabled by default, so no qualifying order is needed.

| Method | Path | Auth | Expected | Notes |
|--------|------|------|----------|-------|
| GET | `{{base_url}}/products/{product_public_id}/reviews` | – | 200 | List approved reviews + rating summary. Query: `page`, `limit`, `rating` (exact, 1–5), `sort` (`created_at`, `rating`; default `-created_at`). Response `data`: `{ summary: { average_rating, total_count }, reviews[], pagination }`. 404 if the product is missing/deleted |
| GET | `{{base_url}}/reviews/{review_public_id}` | – | 200 | Single approved review. 404 for unapproved, soft-deleted, or foreign reviews |
| POST | `{{base_url}}/reviews` | cookie | 201 | Body: `product_public_id` (required), `rating` (required, 1–5), `title`? (≤255), `comment`? (≤5000), `images`? (≤5 items, each `image_url` — absolute http/https — + `alt_text`? ≤255). 404 if the product is missing/deleted; **409** on a duplicate review for the same product |
| PATCH | `{{base_url}}/reviews/{review_public_id}` | cookie | 200 | Partial update of own review: `rating`?, `title`? / `comment`? (`null` clears), `images`? (**replace-all**). Empty body → 400. 404 for foreign/unknown reviews |
| DELETE | `{{base_url}}/reviews/{review_public_id}` | cookie | 204 | Soft-deletes own review + hard-deletes its images |
| GET | `{{base_url}}/users/me/reviews` | cookie | 200 | Own reviews incl. unapproved (`is_approved` is exposed here and only here on the customer side). Query: `page`, `limit`, `sort` |

### 6.10 Folder: `10 Admin Reviews`

All requests carry the `Cookie: {{session_cookie}}` header **and** require the `admin` role (see §5.3).

| Method | Path | Expected | Notes |
|--------|------|----------|-------|
| GET | `{{base_url}}/admin/reviews` | 200 | Moderation queue. Query: `page`, `limit`, `search` (product name / title / comment / customer email / customer name), `rating`, `is_approved` (`true`/`false`/`all`; default `all`), `include_deleted`, `sort`. Images are returned on the detail endpoint, not in list rows |
| GET | `{{base_url}}/admin/reviews/{review_public_id}` | 200 | One review in **any** state (incl. unapproved/soft-deleted) with images + customer summary (`customer_public_id`, `customer_email`) |
| PATCH | `{{base_url}}/admin/reviews/{review_public_id}` | 200 | Moderate: `is_approved`?, `rating`?, `title`? / `comment`? (`null` clears). No `images` here. 400 on empty body or when **approving a soft-deleted review** (deleted reviews are terminal in v1) |
| DELETE | `{{base_url}}/admin/reviews/{review_public_id}` | 204 | Soft-deletes + hard-deletes images; 404 for unknown reviews |

---

## 7. Assertions

All responses use the shared envelope:

- Success (single): `{ "success": true, "data": { … } }`
- Success (list): `{ "success": true, "data": [ … ], "pagination": { "page", "limit", "total", "totalPages", "hasNext", "hasPrev" } }`
- Error: `{ "success": false, "message": "…" }` — validation failures also include an `errors` object

Never expect internal DB ids (`id`) or `deleted_at` in any payload; resources are identified by public IDs (`usr_…`, `prd_…`, `cat_…`, `var_…`, `pimg_…`, `vimg_…`, `adr_…`, `ses_…`, `vrf_…`, `crt_…`, `ord_…`, `pay_…`, `shp_…`, `rv_…`, `rvimg_…`).

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
4. `POST /admin/products/{product_public_id}/variants` (create an `ACTIVE` variant — required for customer visibility; capture `variant_public_id`)
5. `POST /admin/inventory` (create an inventory record for the variant — **required for checkout**; body: `variant_public_id`, `quantity_on_hand`)
6. `GET /admin/inventory/{variant_public_id}` (`quantity_available` mirrors `quantity_on_hand`)
7. `GET /admin/products/uploads/imagekit-auth` (signed upload params)
8. `POST /admin/categories` (capture `category_public_id`)
9. `PUT /admin/categories/{category_public_id}/products/{product_public_id}` (assign; repeat → still 204, idempotent)
10. `GET /categories/{category_public_id}/products` (customer view now lists the product)
11. `GET /categories/{category_public_id}` (customer `product_count` reflects the assignment)
12. `PATCH /admin/categories/{category_public_id}` (`is_active: false`) → step 10 now **404s**
13. `PATCH /admin/categories/{category_public_id}` (`is_active: true`) → step 10 works again
14. `DELETE /admin/categories/{category_public_id}` (soft-delete; links removed; repeat → 404)
15. `DELETE /admin/products/{product_public_id}` (soft-delete)

### Flow C — Account security

1. `POST /auth/register`
2. `PATCH /users/me/password` (change password)
3. `POST /auth/login` with the **new** password (old sessions revoked — old cookie now 401)
4. `POST /users/me/email` (rate-limited; 202)
5. `POST /auth/sessions` → list, capture a `session_public_id` other than the current one
6. `DELETE /auth/sessions/{session_public_id}` (revoke another session)
7. `DELETE /users/me` (delete account; cookie is cleared)

### Flow D — Order lifecycle (cart → checkout → fulfillment)

Self-contained: creates its own product, variant, and inventory as the admin, then exercises the full order journey as a customer and drives fulfillment back as the admin. Needs an admin account (from Flow B step 1). The login/register steps swap `session_cookie` between the two roles — keep them in the right order.

1. `POST /auth/login` as the admin user
2. `POST /admin/products` (capture `product_public_id`)
3. `POST /admin/products/{product_public_id}/variants` (create an `ACTIVE` variant; capture `variant_public_id`)
4. `POST /admin/inventory` (body: `variant_public_id`, `quantity_on_hand: 10`)
5. `POST /auth/register` (new customer — session cookie switches to the customer)
6. `POST /users/me/addresses` (create a shipping address; capture `address_public_id`)
7. `POST /cart/items` (body: `variant_public_id`, `quantity: 1`) → 200; cart created lazily
8. `POST /cart/items` (same variant, `quantity: 1`) → the line **merges** to quantity 2
9. `GET /cart` (`items_count: 1`, `total_quantity: 2`, `subtotal` = 2 × unit price)
10. `PATCH /cart/items/{variant_public_id}` (`quantity: 3`) → absolute set; subtotal updates
11. `POST /orders` (body: `address_public_id`, `payment_method: "mock"`) → 201, status `confirmed`; capture `order_public_id`
12. `GET /orders/{order_public_id}` (payment `succeeded`, item subtotal/discount/shipping/tax/total)
13. `POST /auth/login` as the admin user (session cookie switches back)
14. `GET /admin/orders` (the order is listed; `GET /admin/inventory/{variant_public_id}` now shows `quantity_available` = 7)
15. `PATCH /admin/orders/{order_public_id}` (`status: processing`) → 200
16. `PATCH /admin/orders/{order_public_id}` (`status: shipped`, `carrier: "FedEx"`, `tracking_number: "123456789"`) → 200 (`carrier` is required for this transition)
17. `PATCH /admin/orders/{order_public_id}` (`status: delivered`) → 200
18. `PATCH /admin/orders/{order_public_id}` (`status: delivered`) → **409** (same-status no-op)
19. `PATCH /admin/orders/{order_public_id}` (`status: processing`) → **409** (illegal transition backwards)
20. `GET /admin/orders/{order_public_id}` (shipment carries `carrier` + `tracking_number`)

### Flow E — Reviews lifecycle

Requires a product that exists at the time of the flow (run after Flow B step 8, or reuse a seeded product's `product_public_id`). Reviews are auto-approved (`is_approved` defaults `true`), so a new review is immediately public. Needs an admin account for moderation.

1. `POST /auth/register` (customer)
2. `POST /reviews` (body: `product_public_id`, `rating: 5`, `title`, `comment`) → 201; capture `review_public_id`
3. `GET /products/{product_public_id}/reviews` → review visible; `summary.average_rating` reflects it
4. `GET /users/me/reviews` → `is_approved: true` (the one customer-side view that exposes moderation state)
5. `POST /reviews` (same product) → **409** (one review per user per product)
6. `PATCH /reviews/{review_public_id}` (`rating: 4`, `comment`) → 200
7. `POST /auth/login` as the admin user
8. `GET /admin/reviews` (moderation queue shows the review)
9. `PATCH /admin/reviews/{review_public_id}` (`is_approved: false`) → 200
10. `GET /products/{product_public_id}/reviews` → review now **hidden**; summary updated
11. `PATCH /admin/reviews/{review_public_id}` (`is_approved: true`) → visible again
12. `POST /auth/login` as the customer
13. `DELETE /reviews/{review_public_id}` → 204
14. `GET /reviews/{review_public_id}` → **404**; `GET /products/{product_public_id}/reviews` no longer lists it
15. `POST /auth/login` as the admin user → `GET /admin/reviews/{review_public_id}` → still **200** with `deleted_at` (soft-delete preserved)

---

## 9. Rate limiting

- Route-level limiters apply **5 requests / 15 minutes** per user to: `POST /auth/email-verification/resend`, `POST /auth/password-reset`, `PATCH /users/me/password`, `POST /users/me/email`, `POST /users/me/phone-number`. Exceeding them returns **429**.
- The global API rate limiter is skipped only when `NODE_ENV=test`; under `npm run dev` it is active.
- When re-running flows, either pace requests or use fresh test users (registration is not rate-limited by these rules).

---

## 10. Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| 400 with `errors` | Validation failed. Check the message details: E.164 phone (`+1…`), password policy, slug regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`, name/limit constraints, cart quantity 1–999, `quantity_on_hand`/`quantity_change` mutual exclusion on inventory, `carrier` required when an order moves to `shipped`, empty PATCH body |
| 401 | No session cookie, expired/revoked session, or deactivated account → run Login again (or Register) to refresh `session_cookie` |
| 403 | Authenticated but not `admin`/`super_admin` → promote via `npm run admin:create` (first promotion → `SUPER_ADMIN`). On the role endpoint, `403` also means the session is a regular `ADMIN` (super admin required) |
| 404 | Unknown public ID, **or** an intentionally hidden resource (inactive/soft-deleted category, a product without an `ACTIVE` variant, an order/review that is absent, foreign, unapproved, or soft-deleted, or `GET /cart` before the first add) — the API does not reveal existence |
| 409 | Duplicate `name`/`slug` (categories), `slug`/SKU (products), email/phone (auth/users, incl. admin user updates), **demoting the last admin** (role change), **order not placeable** (empty cart, non-purchasable item, insufficient stock, invalid coupon), **illegal/same-status order transition**, **duplicate inventory record** or **stock delta below zero**, or **duplicate review** for the same product |
| 429 | Route rate limiter exceeded → wait 15 min or use a fresh account |
| 500 | Server error — check `logs/log.json`; do not rely on the response body for internals |
| Cookie not sent | Confirm the request actually carries `Cookie: {{session_cookie}}` (or the cookie jar is enabled); the value must be `session=<token>` |
| Timestamps look shifted | The API returns ISO 8601 UTC; the local pg session is forced to UTC |

---

## 11. Notes

- **CSRF:** `csrf-csrf` is installed but **not yet wired** into the request pipeline, so no CSRF token header is required today. If CSRF middleware is added, cookie-authenticated writes will need the documented fetch/validate token flow; revisit this guide then.
- **Email/OTP tokens in dev:** verification links and the SMS OTP are delivered by real services (Resend) or the SMS stub (logs only). For local testing, read the pending token from the `verification_tokens` table (email-verification, email-change, and password-reset tokens all live there) or use the backend-served verify pages (`/verify-email?token=…`, `/verify-email-change?token=…`).
- **Email verification is not required** for the flows in this guide: customer browsing and admin operations work with a fresh unverified account.
- **Role changes are logged, not audited:** `PATCH /admin/users/{user_public_id}/role` records `actorId`, `targetUserId`, `previousRole`, `newRole` in the structured logger; a dedicated audit-log table is a documented future enhancement (see `docs/ENDPOINT_TESTING.md` for hand-run role-endpoint cases).
- **ImageKit:** image URLs in product/variant image payloads must be absolute http/https URLs (validated). The API never receives file bytes — clients upload to ImageKit using the signed params from `GET /admin/products/uploads/imagekit-auth` and then store the returned URL.
- **Order payments are mocked in v1:** `POST /orders` only accepts `payment_method: "mock"`. The payment is marked `succeeded` inline, so new orders start `confirmed` and can be moved through the fulfillment lifecycle by an admin.
- **Reviews are auto-approved:** `is_approved` defaults to `true` on creation, so a fresh review is immediately public. The optional purchase-verification gate (`REVIEWS_REQUIRE_PURCHASE`) is disabled by default — no qualifying order is needed to write a review.
- **OpenAPI import (follow-up):** generating an OpenAPI 3.1 specification from `docs/api/**` would make Apidog setup one-click (Import → OpenAPI/Swagger). The design docs are written to be directly convertible, per `docs/API_DESIGN.md`.
- The API contract (endpoints, fields, error semantics) is defined in `docs/API_DESIGN.md` and the per-module docs under `docs/api/**` — when in doubt, those are the source of truth.
