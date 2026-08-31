# T-095 — Report controllers & routes (SUPER_ADMIN)

| Field | Value |
|-------|-------|
| **ID** | T-095 |
| **Priority** | P2 |
| **Status** | done |
| **Type** | `feature` |
| **Branch** | `feature/reports-pdf` |
| **Depends on** | T-090, T-092, T-093, T-094 |
| **Blocks** | T-096, T-098 |

## Problem

PDF buffers must be exposed via versioned REST routes with SUPER_ADMIN-only access, Zod validation, and correct download headers.

## Goal

Add `GET /api/v1/admin/reports/{pnl,expenses,revenue}.pdf` (and JSON preview) following the `docs/ARCHITECTURE.md` thin-controller pattern.

## Scope

- `src/modules/reports/controller/admin.controller.ts`: `getPnlPdfController`, `getExpensesPdfController`, `getRevenuePdfController`, plus `getPnlJsonController` when `?format=json` (returns `{ success:true, data }` with decimal-string money, same shape as analytics overview). Thin `try/catch → next(err)`, `req.user!.id` for audit.
- `src/modules/reports/routes/admin.routes.ts`: `Router().use(authentication).use(authorization(SUPER_ADMIN))` (like `src/modules/analytics/routes/admin.routes.ts:28`) with `validate(reportQuerySchema)` per endpoint.
- Mount at `src/routes/v1/index.ts` under `/admin/reports`.
- Response headers for PDF: `Content-Type: application/pdf`, `Content-Disposition: {disposition}; filename="pnl-2026-08.pdf"` (`expenses-…`, `revenue-…`), `Content-Length`, `Cache-Control: no-store`, `X-Report-Currency: {currency}`. Stream with `res.end(buffer)`; JSON branch uses standard `SuccessEnvelope`.
- CSRF applied via top-level router (`csrf-csrf` double-submit for session writes; GET is exempt per `src/middleware/csrf.ts`).

## Acceptance criteria

- [x] `SUPER_ADMIN` `GET /admin/reports/pnl.pdf?period=month&year=2026&month=8` → 200 `application/pdf` streaming; `ADMIN` → 403; unauthenticated → 401.
- [x] `?disposition=inline` yields `inline; filename=…`; `attachment` is default.
- [x] `?format=json` returns JSON without rendering a PDF.

## Implementation notes (2026-08-31)

- Created `src/modules/reports/controller/admin.controller.ts` (3 controllers with `format=json` branch + `sendPdf` helper) and `src/modules/reports/routes/admin.routes.ts` (`SUPER_ADMIN`-only, `validate(reportQuerySchema)`, 6 routes `/pnl`+`/pnl.pdf` etc.) mounted at `src/routes/v1/index.ts` `/admin/reports`.

## References

- `src/middleware/authentication.ts:1`, `src/middleware/authorization.ts:1`, `src/middleware/validate.ts:1`, `src/routes/v1/index.ts:1`
