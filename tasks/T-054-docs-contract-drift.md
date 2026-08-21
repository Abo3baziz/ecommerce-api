# T-054 — Fix documented-vs-implemented contract drift in API_ENDPOINTS.md

| Field | Value |
|-------|-------|
| **ID** | T-054 |
| **Priority** | P2 |
| **Status** | todo |
| **Type** | `docs` |
| **Branch** | `docs/api-endpoints-contract-fix` |
| **Depends on** | — |
| **Blocks** | T-011 (OpenAPI generation must source correct shapes) |

## Problem

`docs/API_ENDPOINTS.md` documents shapes the code does not implement:

- Claims two error envelopes including `{ error: { code, message } }` (lines 44-47) — code uses one envelope everywhere (`src/shared/utils/index.ts:10-18`); zero `{error:{code}}` occurrences in src/tests.
- Claims reviews pagination `{ page, limit, total, has_more }` (lines 38, 2810-2818, 2992, 3033) — code emits `totalPages/hasNext/hasPrev`; tests assert those.

Per AGENTS.md this is a reportable docs/implementation conflict; docs are the contract and currently mislead consumers.

## Goal

API_ENDPOINTS.md matches implemented behavior exactly.

## Scope

- Correct envelope + pagination sections to the single implemented shapes.
- Sweep the doc for any other drift while there (spot-check a sample of endpoints against tests).

## Acceptance criteria

- [ ] No `has_more` / dual-envelope claims remain.
- [ ] Cross-check notes recorded.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.5
