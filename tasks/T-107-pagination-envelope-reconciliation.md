# T-107 — Pagination envelope reconciliation (`meta` vs `pagination`)

| Field | Value |
|-------|-------|
| **ID** | T-107 |
| **Priority** | P2 |
| **Status** | done |
| **Type** | `docs` (contract reconciliation; code changes only if option A is chosen) |
| **Branch** | `docs/pagination-envelope` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

The documented pagination envelope and the implemented one disagree on the
response key, and the drift spans the whole list-endpoint surface:

- **Implementation:** every paginated list controller returns
  `{ success, data, pagination }` — 16 controllers across products, categories,
  orders, reviews, users, coupons, inventory, admins and audit
  (e.g. `src/modules/categories/controller/category.controller.ts:103`,
  `src/modules/products/controller/product.controller.ts:32`). The shape comes
  from `formatPaginationMeta` (`src/shared/utils/index.ts:10`):
  `{ page, limit, total, totalPages, hasNext, hasPrev }`.
- **Specification:** `openapi/openapi.yaml` documents the same pagination
  object under a **`meta`** key (`#/components/schemas/PaginationMeta`) on
  every list response, and `docs/api/**` + `docs/API_ENDPOINTS.md` describe
  `meta` as the only pagination shape.

Discovered while adding `GET /admin/categories/{id}/products` to the spec
(PR #21 / openapi sync): the new endpoint was documented with the **actual**
`pagination` key, so the spec is now internally inconsistent as well.

Consumers already work around the drift: the admin/storefront client has a
dedicated `hasPagination()` guard for the `pagination` key
(`ecommerce-client/src/types/envelopes.ts:73`), and API consumers importing
Apidog/Postman collections from `openapi.yaml` will read the wrong key.

## Goal

Pick one canonical key for paginated list responses and make code, docs and
spec agree everywhere.

## Scope

Decision required (recommended: **Option B**, docs-only, no runtime risk):

- **Option A — standardize on `meta`:** rename `pagination` → `meta` in all 16
  list controllers, update response-reading tests, the client's
  `hasPagination()` guard, and any other consumers. Larger blast radius,
  touches runtime code and two repos.
- **Option B — standardize on `pagination`:** update `openapi/openapi.yaml`
  (`meta` → `pagination` under every list 200 response), `docs/api/**`
  pagination sections, and `docs/API_ENDPOINTS.md`. No runtime change; matches
  what every deployed consumer already reads.

Either way:

1. Enumerate all list endpoints (16 controllers) and fix each spec entry.
2. Add a redocly/CI-friendly consistency note in `openapi/README.md` about the
   canonical key.
3. Add/adjust a test asserting the documented key (guards against future drift).
4. Re-validate `npx @redocly/cli lint openapi/openapi.yaml`.

## Acceptance criteria

- [x] One canonical pagination key documented in `docs/api/**`, `docs/API_ENDPOINTS.md` and `openapi/openapi.yaml`.
- [x] No list endpoint in the spec references the removed key.
- [x] Client `hasPagination()` guard matches the canonical key (Option B: no change needed).
- [x] `npx @redocly/cli lint openapi/openapi.yaml` green.

## References

- `src/shared/utils/index.ts:10` (formatPaginationMeta)
- `src/modules/categories/controller/category.controller.ts:103` (example of the `pagination` key)
- `ecommerce-client/src/types/envelopes.ts:73` (hasPagination guard)
- `openapi/openapi.yaml` (PaginationMeta usages under `meta`)
- Discovered during the openapi sync commit `2e29e25` (System settings epic, PR #22)

## Resolution (2026-09-01)

**Option B implemented** (docs/spec-only): all 19 paginated list responses in
openapi/openapi.yaml now reference PaginationMeta under pagination, the
info description and SuccessEnvelope description were updated, and
openapi/README.md documents the canonical key. Markdown docs
(docs/API_ENDPOINTS.md, docs/api/**) already described pagination — no
changes were needed there. Drift guard added:
	ests/unit/docs/openapi-pagination.test.ts. Redocly lint green; client
hasPagination() guard needed no change.
