# T-057 — CSRF protection for anonymous unsafe endpoints (login CSRF)

| Field | Value |
|-------|-------|
| **ID** | T-057 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `bugfix` |
| **Branch** | `bugfix/anonymous-csrf` |
| **Depends on** | T-001 (done) |
| **Blocks** | — |

## Problem

The CSRF skip rule is `!req.cookies[SESSION_COOKIE_NAME]` (`src/middleware/csrf.ts:22`), so cookie-less requests skip protection entirely — `POST /auth/login`, `/auth/register`, `/auth/password-reset`, `/auth/email-verification/verify` are unprotected. Enables login CSRF (silently logging a victim into an attacker-controlled account) and forged anonymous submissions. Everything else about the T-001 implementation is solid.

## Goal

Anonymous unsafe endpoints resist cross-site forged submissions.

## Scope

- Apply Origin/Referer validation for anonymous unsafe methods (simplest robust option), or issue pre-session CSRF cookies for these flows.
- Keep the static verify pages working (they post tokens; confirm compatibility).
- Document the chosen mechanism in `docs/api/authentication/csrf.md`.

## Acceptance criteria

- [ ] Cross-site form-post to login blocked (Origin mismatch → 403).
- [ ] Same-origin flows unaffected; CSRF e2e suite extended.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.2
