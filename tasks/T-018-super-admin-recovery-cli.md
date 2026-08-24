# T-018 — SUPER_ADMIN recovery / demotion CLI

| Field | Value |
|-------|-------|
| **ID** | T-018 |
| **Priority** | P2 |
| **Status** | done |
| **Type** | `feature` / ops |
| **Branch** | `feature/super-admin-recovery-cli` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

`SUPER_ADMIN` is permanent and CLI-created. Recovery of a lost/compromised super admin requires **manual DB intervention**.

## Goal

Operator CLI to safely transfer or recover super-admin privilege with guardrails.

## Scope

- Extend or add CLI next to `admin:create`.
- Operations: promote-to-super-admin (demote previous?), emergency recovery with confirmation flags.
- Never print secrets; require explicit `--confirm`.
- Document in `docs/OPERATIONS.md`.
- Integration tests with mocked DB or test DB.

## Decisions needed

- [x] Decision: at most one SUPER_ADMIN at all times (matches API docs).
- [x] Decision: demotion happens only as an atomic transfer to a confirmed successor.

## Acceptance criteria

- [x] Documented recovery path without raw SQL.
- [x] Guards prevent lockout (zero super admins).
- [x] Tests + ops docs.

## References

- `PROJECT_PROGRESS.md` — Pending
- `docs/OPERATIONS.md`
