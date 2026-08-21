# T-010 — Deploy & ops checklist (secrets, monitoring, backups)

| Field | Value |
|-------|-------|
| **ID** | T-010 |
| **Priority** | P1 |
| **Status** | todo |
| **Type** | `docs` / `chore` |
| **Branch** | `docs/deploy-ops-checklist` (or `chore/…` if scripts added) |
| **Depends on** | — |
| **Blocks** | Confident production cutover |

## Problem

There is no single operator-facing production cutover checklist covering secrets rotation, monitoring/alerts, DB backups, multi-instance concerns, rate-limit tuning, and health verification.

## Goal

Produce a practical production ops runbook and close any critical tooling gaps discovered while writing it.

## Scope

Document (and implement only if missing and small):

- Environment/secrets inventory (`SESSION_SECRET`, DB URL, Resend, ImageKit, future SMS/payment keys).
- Secrets rotation procedure.
- PostgreSQL backup + restore drill.
- Process model (PM2/systemd/container), zero-downtime notes.
- Multi-instance: sticky sessions not required (DB sessions); rate-limit store (in-memory limiter is **not** multi-instance safe — document or switch to Redis).
- Logging/monitoring/alerting (error rate, 5xx, DB connectivity).
- Health checks (`/health`) + uptime probe.
- Migration runbook (`prisma migrate`).
- Incident response basics.
- Update `docs/OPERATIONS.md` (or new `docs/DEPLOYMENT.md`).

## Acceptance criteria

- [ ] Runbook merged and linked from `AGENTS.md` / docs index if appropriate.
- [ ] Multi-instance rate-limit risk explicitly called out with a mitigation path.
- [ ] Backup/restore steps are actionable.

## References

- `docs/OPERATIONS.md`
- `docs/LOGGER.md`
- `src/middleware/rateLimiter.ts`
