# T-052 — Health/readiness endpoint with DB probe, above the rate limiter

| Field | Value |
|-------|-------|
| **ID** | T-052 |
| **Priority** | P2 |
| **Status** | todo |
| **Type** | `feature` |
| **Branch** | `feature/health-readiness` |
| **Depends on** | — |
| **Blocks** | T-010 (deploy checklist consumes this) |

## Problem

`/health` returns static `{ status:"ok" }` (`src/app/index.ts:55-57`) without checking DB connectivity, and sits behind the global rate limiter — LB probes (>100/15min from one IP) will 429-flap and mark healthy instances unhealthy. Liveness and readiness are conflated.

## Goal

Cheap liveness + dependency-aware readiness, both outside rate limiting.

## Scope

- Keep `/health` as fast liveness; move it above the global limiter.
- Add `/health/ready` performing `SELECT 1` with a short timeout, reporting DB status.
- Document probe semantics in `docs/OPERATIONS.md`.

## Acceptance criteria

- [ ] `/health` never 429s under probe load.
- [ ] `/health/ready` reflects DB outage (503) and recovery.
- [ ] Tests for both endpoints.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.5
