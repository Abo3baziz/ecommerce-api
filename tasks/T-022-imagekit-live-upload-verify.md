# T-022 — Live ImageKit client-side upload verification

| Field | Value |
|-------|-------|
| **ID** | T-022 |
| **Priority** | P2 |
| **Status** | todo |
| **Type** | `test` / ops |
| **Branch** | `test/imagekit-live-upload` or docs-only |
| **Depends on** | Real ImageKit keys in a safe environment |
| **Blocks** | — |

## Problem

Server-side auth-params endpoint was verified; **live client-side upload** (browser/script uploads with issued params, then product image row created) was never automated/end-to-end verified.

## Goal

Document and/or script a manual/staging verification of the full upload path.

## Scope

- Staging checklist or script using ImageKit upload API with issued signature.
- Confirm file lands in media library and admin can attach URL to product/variant image.
- Do **not** call real ImageKit from CI with production keys.
- Update OPERATIONS or ENDPOINT_TESTING docs.

## Acceptance criteria

- [ ] Written verification procedure exists and has been run once in staging.
- [ ] Result recorded in PROJECT_PROGRESS.

## References

- `PROJECT_PROGRESS.md` — Pending
- ImageKit auth endpoint under admin products
