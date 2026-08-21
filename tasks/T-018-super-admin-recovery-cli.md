# T-018 — SUPER_ADMIN recovery / demotion CLI

| Field | Value |
|-------|-------|
| **ID** | T-018 |
| **Priority** | P2 |
| **Status** | todo |
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

- [ ] Allow at most one SUPER_ADMIN always?
- [ ] Can SUPER_ADMIN be demoted only when another exists?

## Acceptance criteria

- [ ] Documented recovery path without raw SQL.
- [ ] Guards prevent lockout (zero super admins).
- [ ] Tests + ops docs.

## References

- `PROJECT_PROGRESS.md` — Pending
- `docs/OPERATIONS.md`
