# T-106 — System settings docs & QA

| Field | Value |
|-------|-------|
| **ID** | T-106 |
| **Priority** | P2 |
| **Status** | done |
| **Type** | `chore` |
| **Branch** | `feature/system-settings` |
| **Depends on** | T-100..T-105 |
| **Blocks** | — |

## Problem

After code, contracts drift without docs and verification.

## Goal

Update API docs, OpenAPI, and verify manually + typecheck without destructive DB tests.

## Scope

- `docs/api/admin/settings.md` — per-section `GET/PATCH`, auth 403 cases, masked secrets, audit action table.
- `docs/API_ENDPOINTS.md` — add 10 rows for settings.
- `openapi/openapi.yaml` + `openapi/admin-settings.yaml` components for 9 sections (money strings, enums).
- `PROJECT_PROGRESS.md` — mark T-100..T-105 done.
- Manual smoke: `curl -b cookies -H x-csrf-token` `GET` each section SUPER_ADMIN 200, ADMIN 403; `PATCH` valid 200 + audit row, invalid 400, secret masked; maintenance toggle returns 503 for storefront but 200 for `/admin`.
- `npm run typecheck` green; no `npm test` against dev DB per T-032.

## Acceptance criteria

- [ ] Docs updated and match controller validation.
- [ ] OpenAPI validates via `npx redocly lint`.
- [ ] Manual `curl` smoke checklist checked.
- [ ] `PROJECT_PROGRESS.md` updated.

## References

- `docs/api/admin/audit.md:1`, `docs/API_ENDPOINTS.md:1`, `openapi/openapi.yaml:1`, `AGENTS.md` (Git Workflow)
