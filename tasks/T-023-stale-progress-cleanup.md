# T-023 — Clean stale Next Step entries in PROJECT_PROGRESS

| Field | Value |
|-------|-------|
| **ID** | T-023 |
| **Priority** | P2 |
| **Status** | todo |
| **Type** | `docs` |
| **Branch** | `docs/progress-cleanup` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

`PROJECT_PROGRESS.md` **Next Step** still lists items that are already done (password-reset uncommitted, §2.3 decision needed, stale Apidog commit note, duplicate OpenAPI lines). This misleads agents and humans.

## Goal

Reconcile Completed / Pending / Next Step with actual `main` state; point Next Step at `tasks/README.md` for the backlog.

## Scope

- Remove or rewrite stale bullets.
- Add pointer: production backlog lives in `tasks/`.
- Keep historical Completed entries intact.

## Acceptance criteria

- [ ] No “uncommitted password-reset” or “§2.3 decision needed” while those are merged.
- [ ] Next Step references `tasks/README.md`.
- [ ] Pending list matches real open work (or defers to tasks/).

## References

- `PROJECT_PROGRESS.md`
- `tasks/README.md`
