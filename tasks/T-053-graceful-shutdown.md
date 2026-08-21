# T-053 — Complete graceful shutdown (sockets, Prisma, log flush)

| Field | Value |
|-------|-------|
| **ID** | T-053 |
| **Priority** | P2 |
| **Status** | todo |
| **Type** | `bugfix` |
| **Branch** | `bugfix/graceful-shutdown` |
| **Depends on** | T-034 (flush semantics depend on sink) |
| **Blocks** | — |

## Problem

Shutdown is `server.close()` only (`src/server.ts:11-21`): keep-alive sockets keep the callback pending indefinitely; no forced-exit timeout; `prisma.$disconnect()` never called. Crash handlers `process.exit(1)` immediately while fatal entries are still queued behind the async file-write chain (`logger/index.ts:136`) → crash logs likely never reach disk.

## Goal

Predictable, bounded shutdown that persists final logs and closes DB connections.

## Scope

- Stop intake → `closeIdleConnections()` (and `closeAllConnections()` after grace period) → race `server.close()` with a timeout → `prisma.$disconnect()` → flush logger → exit.
- Ensure crash handlers flush synchronously-enough or accept documented loss window.

## Acceptance criteria

- [ ] SIGTERM exits within the configured bound with open keep-alive connections.
- [ ] Fatal log written before exit on crash path.
- [ ] No hanging processes in local/CI runs.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.5
