# Endpoint Testing

## Overview

This document defines **practical, hand-run test cases** for implemented API endpoints. It complements `docs/TESTING.md` (automated testing strategy) and `docs/APIDOG_TESTING.md` (Apidog workflow) with concrete scenarios a developer can execute against a local server to verify behavior beyond the automated suites.

The API contract remains the source of truth in `docs/api/**`; the test cases here are organized by endpoint and list the exact request, expected status, and what to assert in the response.

## Environment

- Start the server: `npm run dev` (boots on `http://localhost:3000`).
- Sign requests with the session cookie from `POST /api/v1/auth/login` or `POST /api/v1/auth/register`.
- Promote a test account to admin once via `npm run admin:create` (see `docs/OPERATIONS.md`).
- Expected envelope on every response: success `{ "success": true, "data": … }`, error `{ "success": false, "message": "…" }` (validation errors also carry an `errors` object).
- Never expect internal DB ids in any payload; users are identified by `public_id` (`usr_…`).

---

# Change User Role — `PATCH /api/v1/admin/users/{user_public_id}/role`

Focused, end-to-end test cases for the role-management endpoint.

## Setup

| Step | Action |
| --- | --- |
| 1 | Register a customer via `POST /api/v1/auth/register` → capture `public_id` (**customer A**) |
| 2 | Register a second customer (**customer B**) |
| 3 | Bootstrap the super admin: `npm run admin:create` on customer A → becomes `SUPER_ADMIN` (first promotion) |
| 4 | Promote a third user to a regular `ADMIN` via the CLI (a `SUPER_ADMIN` now exists) |
| 5 | Log in as customer A so the session carries the `SUPER_ADMIN` role |

## Positive cases

| # | Scenario | Request body | Expected | Assertions |
| --- | --- | --- | --- | --- |
| 1 | Super admin promotes a customer | `{ "role": "ADMIN" }` on customer B | `200` | `data.public_id` matches B; `data.role === "ADMIN"`; response has no internal `id` |
| 2 | Super admin demotes an admin to customer | `{ "role": "CUSTOMER" }` on customer B | `200` | `data.role === "CUSTOMER"` |
| 3 | Idempotent no-op | `{ "role": "CUSTOMER" }` on customer B (already customer) | `200` | `data.role === "CUSTOMER"`; unchanged |
| 4 | CLI first promotion | `npm run admin:create` with no `SUPER_ADMIN` in the DB | exit `0` | message "No SUPER_ADMIN exists yet." + "User successfully promoted to SUPER_ADMIN."; DB role is `SUPER_ADMIN` |
| 5 | CLI subsequent promotion | `npm run admin:create` with a `SUPER_ADMIN` present | exit `0` | message "User successfully promoted to ADMIN."; DB role is `ADMIN` |

## Negative cases

| # | Scenario | Request | Expected | Assertions |
| --- | --- | --- | --- | --- |
| 6 | Unauthenticated | No cookie | `401` | `success === false` |
| 7 | Non-admin session | Log in as a plain customer and call it | `403` | `success === false` |
| 8 | Regular admin actor | Log in as a regular `ADMIN` and promote/demote anyone | `403` | Any role change (incl. a no-op) is blocked for non-super-admin actors |
| 9 | Unknown public id | `PATCH /admin/users/usr_does_not_exist/role` with valid super-admin session | `404` | `success === false`; message does not reveal account details |
| 10 | Demoting the super admin | Super admin targets another `SUPER_ADMIN` (or a regular admin targets one) | `403` | The `SUPER_ADMIN` role can never be changed |
| 11 | Super admin changing own role | Call on your own `public_id` with `{ "role": "CUSTOMER" }` | `400` | `message` explains self-role-change is forbidden |
| 12 | Invalid role value | `{ "role": "SUPERUSER" }` | `400` | `errors.role` present; body rejected before any DB write |
| 13 | Assigning `SUPER_ADMIN` via the API | `{ "role": "SUPER_ADMIN" }` | `400` | `SUPER_ADMIN` is CLI-only; the validator rejects it |
| 14 | Empty public id | `PATCH /admin/users//role` (no id) | `400`/`404` (routing) | Validation error surfaces; no crash |
| 15 | Removing the last admin-privileged user | With only a `SUPER_ADMIN` and no regular admins, demote the sole remaining admin (edge: DB state with one admin-privileged account) | `409` | `message` mentions the last-administrator rule; role unchanged in DB |

## Post-condition checks

- The DB always contains exactly one `SUPER_ADMIN` and it is never demoted (verify `role` via SQL after case 10/11).
- After case 15 (if exercised), verify the DB still contains ≥1 admin-privileged user.
- Each successful change is written to the structured logger (`logs/`) with `actorId`, `targetUserId`, `previousRole`, and `newRole`.
- Clean up all test accounts (they carry `test-*` emails so `cleanupTestData()` in `tests/helpers/db.ts` removes them in the automated suites).

---

# Admin Users CRUD — smoke cases

| # | Endpoint | Scenario | Expected |
| --- | --- | --- | --- |
| 1 | `GET /admin/users` | Admin session | `200`; `data` only `CUSTOMER` rows; `pagination` present |
| 2 | `GET /admin/users?status=SUSPENDED` | A suspended customer exists | `200`; only suspended customers returned |
| 3 | `GET /admin/users?search={email}` | Partial email of a customer | `200`; filtered list contains it |
| 4 | `GET /admin/users?sort=email` | – | `200`; ascending by email |
| 5 | `GET /admin/users/{customer_public_id}` | Existing customer | `200`; `data.role === "CUSTOMER"` |
| 6 | `PATCH /admin/users/{customer_public_id}` with `{ "first_name": "New" }` | – | `200`; name updated |
| 7 | `PATCH /admin/users/{customer_public_id}` with an email already used by another account | – | `409` |
| 8 | `PATCH /admin/users/{customer_public_id}/suspend` | Active customer | `200`; `data.status === "SUSPENDED"`; **their sessions are revoked** (their cookie now returns `401`) |
| 9 | `PATCH /admin/users/{customer_public_id}/suspend` again | Already suspended | `400` |
| 10 | `PATCH /admin/users/{customer_public_id}/activate` | Suspended customer | `200`; `data.status === "ACTIVE"`; customer must log in again |
| 11 | All endpoints with a non-admin session | – | `403` |
| 12 | All endpoints without a session | – | `401` |

---

# Reporting results

When you find a discrepancy, record it in the issue tracker and update `PROJECT_PROGRESS.md`. Do **not** change endpoint behavior on your own; follow the priority order in `AGENTS.md` (user request > `AGENTS.md` > docs > implementation).
