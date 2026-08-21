# T-078 — CI hygiene: pin actions, secret fallbacks, restore lost workflows

| Field | Value |
|-------|-------|
| **ID** | T-078 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `chore` |
| **Branch** | `chore/ci-hygiene` |
| **Depends on** | T-050 (trigger policy first) |
| **Blocks** | — |

## Problem

1. Actions pinned by mutable tags (`checkout@v5`, `setup-node@v5`), not SHAs.
2. If GitHub secrets are unset (fork PRs), empty SESSION_SECRET fails env validation confusingly mid-test.
3. PROJECT_PROGRESS records `pr-title.yml`, `prisma-validate.yml`, `audit.yml`, `labeler.yml` + `.github/labeler.yml` as created, but only `ci.yml` exists in the repo — four workflows were never committed or were lost.

## Goal

Reproducible, supply-chain-safe CI matching documented state.

## Scope

- Pin actions by SHA (or add dependabot); provide dev/dummy secret fallbacks for fork PRs where safe.
- Recreate or explicitly drop the four missing workflows; reconcile with PROJECT_PROGRESS notes.

## Acceptance criteria

- [ ] Workflows match repo reality; pins/SHAs in place; fork-PR path sane.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.5
