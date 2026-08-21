# T-075 — CORS multi-origin support

| Field | Value |
|-------|-------|
| **ID** | T-075 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `feature` |
| **Branch** | `feature/cors-multi-origin` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

`CORS_ORIGIN` is a single URL (`src/config/env.ts:11`) passed directly as `cors({ origin })`. Whitelisting multiple origins (web + mobile web + admin panel) requires code changes.

## Goal

Comma-separated `CORS_ORIGIN` list supported while remaining backward-compatible.

## Scope

- Accept comma-separated env value; normalize/trim; validate each entry is a URL.
- Pass array to cors; document in env examples + ops docs.

## Acceptance criteria

- [ ] Multi-origin config works; single-origin unchanged.
- [ ] Invalid entries fail fast at boot per existing zod pattern.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.5
