# T-077 — Tooling config: engines, tsconfig strictness, dead alias, coverage floors

| Field | Value |
|-------|-------|
| **ID** | T-077 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `chore` |
| **Branch** | `chore/tooling-config` |
| **Depends on** | T-028 (resolution strategy settled first) |
| **Blocks** | — |

## Problem

1. No `engines` field in package.json though CI targets Node 22.
2. tsconfig holes: no `noUncheckedIndexedAccess`, `noUnusedLocals/noUnusedParameters`.
3. Dead path alias: tsconfig `paths @/*` defined but zero usages.
4. vitest has no `coverage.thresholds` despite the `test:coverage` script; no retry policy (flake handled ad hoc per git history).

## Goal

Tooling pins reality and catches regressions.

## Scope

- Add engines; enable stricter flags incrementally (fix fallout); remove alias or adopt it; set initial coverage floors at current baseline and ratchet later.

## Acceptance criteria

- [ ] Config changes land with typecheck/suite green; floors recorded.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.5
