# T-022 — Live ImageKit client-side upload verification

| Field | Value |
|-------|-------|
| **ID** | T-022 |
| **Priority** | P2 |
| **Status** | done |
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

- [x] Written verification procedure exists and has been run once in staging.
- [x] Result recorded in PROJECT_PROGRESS.

## References

- `PROJECT_PROGRESS.md` — Pending
- ImageKit auth endpoint under admin products

## Verification Record (2026-08-24)

Full live path verified end-to-end while debugging upload failures:

- Server-side params (HMAC-SHA1 of privateKey+token+expire via @imagekit/nodejs)
  accepted by https://upload.imagekit.io/api/v1/files/upload -> HTTP 200, file visible
  in media library (test files deleted afterwards).
- Browser-side XHR from the app origin (http://localhost:3001) with WebCrypto-signed
  params -> HTTP 200; no CORS issues with the dedicated upload host.
- Full UI path confirmed after fixing validateUploadedImageUrl: admin product image
  persisted via POST /admin/products/:id/images.
- Note: ImageKit verifies HMAC-SHA1(privateKey, token+expire); plain SHA1 concat
  (legacy docs) is rejected with 400 invalid-signature.
