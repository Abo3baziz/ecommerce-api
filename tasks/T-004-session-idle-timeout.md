# T-004 — Session idle-timeout via `last_activity_at`

| Field | Value |
|-------|-------|
| **ID** | T-004 |
| **Priority** | P1 |
| **Status** | done |
| **Type** | `bugfix` / security |
| **Branch** | `bugfix/session-idle-timeout` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

Sessions have a fixed TTL and `last_activity_at` is updated on authenticated requests, but there is **no idle-timeout enforcement**. A session can remain valid for the full TTL even if unused for long periods (beyond a desired idle window).

## Goal

Reject sessions whose `last_activity_at` is older than a configured idle timeout (e.g. 30 days idle, or a shorter product-chosen window).

## Scope

- Add constant/config: `SESSION_IDLE_TIMEOUT_MS` (document default).
- In `authentication` middleware: after loading session, if idle exceeded → treat as unauthorized (optionally revoke).
- Align with `SESSION_TTL_MS` semantics (idle vs absolute expiry).
- Docs: `docs/AUTHENTICATION.md`.
- Tests: active session OK; idle session → 401.

## Acceptance criteria

- [x] Idle sessions rejected with 401.
- [x] Fresh activity keeps session valid within absolute TTL.
- [x] Config documented.
- [x] Tests green.

## References

- `PROJECT_PROGRESS.md` — Pending
- `src/middleware/authentication.ts`
- `src/shared/constants/session.ts`
