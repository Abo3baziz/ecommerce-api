# T-005 — Expired-session cleanup job

| Field | Value |
|-------|-------|
| **ID** | T-005 |
| **Priority** | P1 |
| **Status** | done |
| **Type** | `chore` / ops |
| **Branch** | `chore/session-cleanup-job` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

Expired and revoked sessions remain in the database indefinitely. Auth rejects them, but the table grows without bound.

## Goal

Periodic cleanup that deletes (or archives) expired and long-revoked sessions safely.

## Scope

- CLI script and/or scheduled job (document how to run in production — cron, worker, etc.).
- Delete sessions where `expires_at < now` and/or `revoked_at` older than retention window.
- Batch deletes; log counts; dry-run flag.
- `docs/OPERATIONS.md` procedure.
- Integration test for the cleanup function.

## Acceptance criteria

- [x] Cleanup removes only eligible rows.
- [x] Operator docs exist.
- [x] Safe to re-run (idempotent).
- [x] Tests green.

## References

- `PROJECT_PROGRESS.md` — Pending
- `docs/OPERATIONS.md`
- `sessions` table
