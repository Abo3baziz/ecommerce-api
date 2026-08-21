# T-050 — Run CI on pushes to main (close the direct-push bypass)

| Field | Value |
|-------|-------|
| **ID** | T-050 |
| **Priority** | P2 |
| **Status** | todo |
| **Type** | `chore` |
| **Branch** | `chore/ci-push-trigger` |
| **Depends on** | — |
| **Blocks** | T-078 (hygiene pass) |

## Problem

`.github/workflows/ci.yml:3-5` triggers on `pull_request` only. Git history shows multiple direct commits to `main` (`8a5a747`, `99955a3`, `72d1d0d`, …) that ran zero checks. The broken build artifact (T-028) was committed exactly this way.

## Goal

Every commit on `main` has passed typecheck + build + tests.

## Scope

- Re-add `push: branches: [main]` trigger, or enable branch protection requiring PRs.
- Prefer branch protection if repo settings allow; else push trigger is mandatory.

## Acceptance criteria

- [ ] A push to main runs the full pipeline.
- [ ] Chosen policy documented in AGENTS.md workflow section if it changes rules.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.5
