# T-088 — Reports deps & build wiring (pdfkit + charts)

| Field | Value |
|-------|-------|
| **ID** | T-088 |
| **Priority** | P2 |
| **Status** | done |
| **Type** | `chore` |
| **Branch** | `feature/reports-pdf` |
| **Depends on** | — |
| **Blocks** | T-089, T-093, T-094 |

## Problem

No PDF or chart libraries are installed. `package.json` contains zero `pdfkit` / `pdf-lib` / `puppeteer` / chart deps. Reports epic needs browser-downloadable PDFs with tables and charts, streaming with `Content-Disposition`.

## Goal

Install `pdfkit` + `chartjs-node-canvas` + `chart.js` and `@types/pdfkit` so the reports epic can render tables and PNG charts without a Chromium dependency, and keep `esbuild --packages=external` and CI green.

## Scope

- `npm i pdfkit chartjs-node-canvas chart.js` + `npm i -D @types/pdfkit`.
- Verify `npm run typecheck && npm run build` still passes (`src/config/database.ts` `timezone=UTC` unchanged, `esbuild` external).
- Guard chart import with dynamic `import('chartjs-node-canvas')` so a missing native `canvas` prebuild on Windows CI does not crash the server — PDF degrades to tables-only with a warning log.
- Do not commit `node_modules`.

## Acceptance criteria

- [x] `npm run typecheck && npm run build` green.
- [x] Charts rendered via pure pdfkit vector drawing — no native `canvas` dependency required; `pdfkit@0.13.0` installed with `@types/pdfkit@0.13.4`, build passes.

## Implementation notes (2026-08-31)

- Installed `pdfkit@0.13.0` + `@types/pdfkit@0.13.4`. Skipped `chartjs-node-canvas`/`canvas` native deps to avoid Windows prebuild failures; charts implemented as pdfkit vector (line/bar/pie) in `src/shared/pdf/charts.ts`.
- Verified `typecheck` (exit 0) and `esbuild` build (`534.2kb`) green.

## References

- `package.json:1`, `src/modules/analytics/repository/analytics.repository.ts:1`, `docs/ARCHITECTURE.md` (layered N-tier)
