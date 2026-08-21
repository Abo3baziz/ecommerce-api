# T-072 — Extend cleanup jobs: verification tokens + CLI disconnect

| Field | Value |
|-------|-------|
| **ID** | T-072 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `chore` |
| **Branch** | `chore/cleanup-jobs-extension` |
| **Depends on** | T-005 (done) |
| **Blocks** | T-067, T-068 (reuse this job pattern) |

## Problem

1. `verification_tokens` rows are invalidated (`used_at`) but never deleted in production paths — expired/used tokens accumulate forever. The cleanup CLI covers sessions only.
2. `scripts/cleanup-sessions.ts` main() never calls `prisma.$disconnect()` (contrast `create-admin.ts:152`) → process exit delayed until pg pool idle timeout; annoying in cron/K8s.

## Goal

One retention story for ephemeral auth data; cron-friendly CLIs.

## Scope

- Extend the cleanup service/CLI to purge used/expired verification tokens past a retention window (flag `--token-retention-days`), batched + dry-run like sessions.
- Add finally-disconnect to all cleanup CLIs.
- Document in `docs/OPERATIONS.md` scheduling section.

## Acceptance criteria

- [ ] Tokens purged per policy; active tokens untouched.
- [ ] CLI exits promptly; docs updated.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.5
