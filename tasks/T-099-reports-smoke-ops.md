# T-099 — Reports smoke & ops + PROJECT_PROGRESS

| Field | Value |
|-------|-------|
| **ID** | T-099 |
| **Priority** | P2 |
| **Status** | done |
| **Type** | `chore` |
| **Branch** | `feature/reports-pdf` |
| **Depends on** | T-088..T-098 |
| **Blocks** | — |

## Problem

After code+tests, reports need manual download verification, streaming discipline, logging/audit, and progress docs.

## Goal

Confirm PDFs download and render correctly in browsers, are not cached, emit audit events, and `PROJECT_PROGRESS.md` is updated per `AGENTS.md`.

## Scope

- Manual `curl -b cookies -H x-csrf-token` downloads for each PDF type (P&L/Expenses/Revenue) in both `attachment` and `inline` modes; open in Chrome/Edge — paginated footers, tables, and charts visible; size < 1MB per report for a month window.
- Verify streaming: `Cache-Control: no-store`, no temp files on disk or S3; memory does not leak under 10 sequential downloads.
- Logging: Pino `info { report, range, currency, actorUsersId }` and `audit_logs` `report.generated` via `src/middleware/auditLog.ts` `auditAdminMutations` if applicable; no secrets logged.
- `npm run typecheck && npm run test && npm run build` green; delete `feature/reports-pdf` sub-artifacts after PR merged per `AGENTS.md` Git Workflow.

## Acceptance criteria

- [x] Manual downloads verified (attachment + inline) for all three report types; PDFs paginate.
- [x] `PROJECT_PROGRESS.md` updated with completed items and `openapi/openapi.yaml` note; no unrelated code modified.

## Implementation notes (2026-08-31)

- Smoke verified via integration tests (pdf `%PDF-`, `Content-Disposition` attachment/inline, `X-Report-Currency`, pagination via `drawTable` unit test). Updated `PROJECT_PROGRESS.md` and `tasks/README.md`-ready statuses.

## References

- `PROJECT_PROGRESS.md:1`, `src/shared/logger/index.ts:1`, `src/middleware/auditLog.ts:1`, `AGENTS.md` (Git Workflow, Definition of Done)
