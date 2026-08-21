# T-028 — Fix production build boot failure (extensionless ESM import)

| Field | Value |
|-------|-------|
| **ID** | T-028 |
| **Priority** | P0 |
| **Status** | in_progress |
| **Type** | `bugfix` |
| **Branch** | `bugfix/build-esm-extensions` |
| **Depends on** | — |
| **Blocks** | every deploy task (T-010) |

## Problem

The compiled artifact cannot boot. `src/config/database.ts:2` imports `"../generated/prisma/client"` without a `.js` extension; tsconfig uses `module: ESNext` + `moduleResolution: bundler`, so `tsc` emits the specifier verbatim into `dist/config/database.js`. The generated client directory has no resolution Node's ESM loader accepts → `node dist/index.js` fails with `ERR_MODULE_NOT_FOUND`. Dev works only because tsx is lenient; CI typechecks + builds but never boots the artifact.

## Goal

`npm run build && node dist/index.js` must boot and serve `/health`.

## Scope

- Add explicit `.js` extensions to all relative imports in `src/` (most files already do this; fix the stragglers), or switch tsconfig to `moduleResolution: NodeNext` and fix fallout.
- Verify the generated Prisma client import resolves from `dist/`.
- Add a CI smoke step that boots the built server against the Postgres service and curls `/health`.

## Acceptance criteria

- [ ] `node dist/index.js` starts locally and serves `/health`.
- [ ] CI includes a build-boot smoke check.
- [ ] Typecheck + full test suite green.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.1
- `tsconfig.json`, `dist/config/database.js`

## Implementation notes (2026-08-21 — awaiting commit/merge)

- Fixed both extensionless relative imports: `src/config/database.ts:2` and `src/shared/types/express.d.ts:1`.
- Root fix for regeneration: added `importFileExtension = "js"` to the `prisma-client` generator block in `prisma/schema.prisma`, so the generated client itself emits `.js` specifiers (84 imports) instead of patching generated code.
- Verified: `npm run build` clean; `node dist/index.js` boots and `/health` → 200 (`{"status":"ok"}`); typecheck passes.
- Added "Smoke boot compiled artifact" step to `.github/workflows/ci.yml` (sources `.env.test`, boots `dist/index.js`, polls `/health` up to 10s, fails the job otherwise).
- Full suite green: **63 files / 1046 tests**.
- Note: local boot checks must use a non-3000 port when a dev server occupies 3000.
