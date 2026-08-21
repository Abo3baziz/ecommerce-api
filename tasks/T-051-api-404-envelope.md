# T-051 — JSON 404 envelope for unknown /api routes

| Field | Value |
|-------|-------|
| **ID** | T-051 |
| **Priority** | P2 |
| **Status** | todo |
| **Type** | `bugfix` |
| **Branch** | `bugfix/api-404-envelope` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

Nothing handles unmatched routes after the static middleware (`src/routes/index.ts:6`, `src/app/index.ts:53-67`). `GET /api/v1/nonexistent` falls through to Express's default HTML 404; wrong-method requests get generic HTML rather than 405. Clients can't distinguish unknown routes programmatically; the HTML page leaks a framework fingerprint and breaks the documented error envelope.

## Goal

All `/api/*` 404/405 responses use the API error envelope.

## Scope

- After the `/api` router mount, add a catch-all returning `{ success:false, message:"Not found" }` with 404 (optionally method-aware 405 with `Allow` header).
- Keep non-API paths' behavior as-is.

## Acceptance criteria

- [ ] Unknown `/api/*` path returns JSON envelope with 404.
- [ ] e2e test added.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.5
