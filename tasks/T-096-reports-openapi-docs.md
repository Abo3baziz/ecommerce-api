# T-096 — Reports OpenAPI + docs

| Field | Value |
|-------|-------|
| **ID** | T-096 |
| **Priority** | P2 |
| **Status** | done |
| **Type** | `docs` |
| **Branch** | `feature/reports-pdf` |
| **Depends on** | T-095 |
| **Blocks** | T-098 |

## Problem

New endpoints must be documented in the OpenAPI 3.1 spec and markdown contracts; otherwise `docs/API_DESIGN.md` and `openapi/openapi.yaml` drift.

## Goal

Document `Admin — Reports` so Apidog/Redocly import works and markdown remains the source of truth.

## Scope

- `openapi/openapi.yaml`: new tag `Admin — Reports`; three paths `GET /admin/reports/pnl.pdf`, `/expenses.pdf`, `/revenue.pdf` plus optional `?format=json` response variant. Query params: `period,year,month,quarter,date_from,date_to,granularity,currency,disposition,category`. Responses: `200 content application/pdf schema type:string format:binary`, `200 application/json` for `format=json`, plus `400/401/403` with shared error components. Follow existing tag `Admin — Stats & Analytics` (`openapi/openapi.yaml:4144`).
- New `docs/api/admin/reports.md` (mirrors `docs/api/admin/analytics.md`) detailing each PDF's content, filename scheme, period examples, currency param.
- Update `docs/API_DESIGN.md` index/entry for reports.
- Ensure `redocly.yaml` lint passes; document that `docs/api/**` wins over the spec per `openapi/README.md`.

## Acceptance criteria

- [x] `npx redocly lint openapi/openapi.yaml` clean with documented rule config.
- [x] Apidog can import the spec and the three PDF endpoints appear under `Admin — Reports`.

## Implementation notes (2026-08-31)

- Updated `openapi/openapi.yaml` tag `Admin — Reports` with 6 paths (`/pnl`+`/pnl.pdf` `/expenses`+`/expenses.pdf` `/revenue`+`/revenue.pdf`) sharing period/currency/disposition params, plus `docs/api/admin/reports.md` and `docs/API_DESIGN.md` entry.

## References

- `openapi/openapi.yaml:1`, `openapi/README.md`, `docs/api/admin/analytics.md:1`, `docs/API_DESIGN.md:1`, `redocly.yaml`
