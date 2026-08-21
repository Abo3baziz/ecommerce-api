# T-048 — Resolve high-severity npm audit findings

| Field | Value |
|-------|-------|
| **ID** | T-048 |
| **Priority** | P2 |
| **Status** | todo |
| **Type** | `chore` |
| **Branch** | `chore/dependency-audit-fixes` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

`npm audit --omit=dev` reports high-severity advisories in the production graph:

- `deepmerge-ts < 8.0.0` (stack exhaustion, GHSA-ggr8-5vv4-36mx) via `@prisma/config` → prisma 6.13.0-dev.1–7.10.0-integration-fix range.
- `fast-uri 3.0.0–3.1.4` (host confusion, GHSA-7p8r-x3mc-p8w7).

## Goal

Clean `npm audit --omit=dev` (or documented accepted-risk list).

## Scope

- Bump prisma to a fixed release when available; `npm audit fix` for fast-uri.
- Re-run full suite + typecheck + build after bumps (Prisma major/minor bumps need client regeneration).
- Add scheduled `npm audit` workflow if absent (coordinate with T-078).

## Acceptance criteria

- [ ] `npm audit --omit=dev` exits clean or findings documented as accepted with rationale.
- [ ] Suite/typecheck/build green post-bump.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.5
