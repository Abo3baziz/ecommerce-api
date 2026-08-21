# T-073 — Public verify pages: safe DOM writes + cache headers

| Field | Value |
|-------|-------|
| **ID** | T-073 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `bugfix` |
| **Branch** | `bugfix/public-pages-hardening` |
| **Depends on** | T-031 (reset-password page adopts same pattern) |
| **Blocks** | — |

## Problem

1. `public/verify-email.js` / `verify-email-change.js` interpolate server strings into `innerHTML` (lines 3-18, 39, 41). Today all messages are developer-controlled constants and helmet CSP mitigates, but it's latent XSS by construction.
2. `express.static` serves with default headers (`src/app/index.ts:59`) — no Cache-Control; token-bearing URLs (until T-034 redacts) may be cached by browsers/proxies; stale HTML after deploys.

## Goal

Defense-in-depth on the backend-served pages.

## Scope

- Switch to `textContent`/element construction in all public pages' JS.
- Set explicit cache headers: static assets reasonable max-age; token pages `no-store`.

## Acceptance criteria

- [ ] No innerHTML with dynamic data remains in public/.
- [ ] Token pages send `Cache-Control: no-store`; verified via supertest headers.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.5
