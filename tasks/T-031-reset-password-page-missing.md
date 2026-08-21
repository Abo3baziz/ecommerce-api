# T-031 — Build the missing reset-password page

| Field | Value |
|-------|-------|
| **ID** | T-031 |
| **Priority** | P1 |
| **Status** | done |
| **Type** | `bugfix` |
| **Branch** | `bugfix/reset-password-page` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

Password-reset emails link to `${CORS_ORIGIN}/reset-password?token=…` (`src/shared/mailer/passwordReset.ts:9`) but no such static page or route exists (`public/` holds only the two verify pages; `src/app/index.ts:60-65` mounts only `/verify-email*`). Users land on Express's default HTML 404 — web-facing password recovery is broken end-to-end even though the API works.

## Goal

A reset-password page that collects the new password and calls `POST /api/v1/auth/password-reset/verify`.

## Scope

- Add `public/reset-password.html` + `.js` mirroring the verify-email page pattern (read `token` from query, post to the API, render success/expired/invalid states).
- Mount `/reset-password` in `src/app/index.ts`.
- Apply T-073 hardening (textContent, no-store) from the start.
- Update `docs/api/authentication/password-reset.md` link description.

## Acceptance criteria

- [ ] Clicking an email link reaches a working form; full reset flow completes in-browser.
- [ ] 404/410 states rendered with matching copy.
- [ ] Tests/e2e for the new route serving 200.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.5
- Pattern: `public/verify-email.html/.js`

## Implementation notes (2026-08-21 — awaiting commit/merge)

- Added `public/reset-password.html` (same card design as the verify pages, plus a new-password + confirm form and the password-policy hint) and `public/reset-password.js`.
- JS uses DOM construction with `textContent` only — no `innerHTML` anywhere (T-073 hardening applied from the start); handles missing token, password mismatch, 204 success, 400 validation (inline form error), 404 invalid link, 410 used/expired, and network failures; button disabled during submit.
- Route `GET /reset-password` added in `src/app/index.ts` serving the page with `Cache-Control: no-store` (token-bearing URL).
- e2e `tests/e2e/auth/passwordResetPage.api.test.ts` (3 tests): page served 200 html + no-store header; script served 200 javascript; assets cross-reference each other and the verify endpoint.
- Docs: reset-link section in `docs/api/authentication/password-reset.md` now documents the backend-served page and its contract.
- Verified live on the compiled artifact: `/health` 200, `/reset-password` 200 + `no-store`, `/reset-password.js` 200. Full suite green (**63 files / 1046 tests**).
