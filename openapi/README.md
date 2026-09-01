# OpenAPI Specification

`openapi.yaml` is a machine-importable projection of the API contract for
one-click import into Apidog/Postman and for client generation.

## Source of truth

The markdown contracts in `docs/api/**` remain **authoritative**. This file is
updated alongside them; on conflict, the markdown wins until this note is
reversed (decision recorded in `tasks/T-011-openapi-spec.md`).

## Maintenance process

1. When adding/changing an endpoint, update the module contract in
   `docs/api/**` first.
2. Mirror the change in `openapi.yaml` in the same commit.
3. Validate locally: `npx @redocly/cli lint openapi/openapi.yaml`
   (CI validation is tracked as follow-up work in `tasks/T-011`).

## Coverage

| Module | Status |
| --- | --- |
| Auth (`/auth/*`) | covered |
| Users profile/password/email/phone + Addresses (`/users/me*`) | covered |
| Catalog, Cart, Orders, Reviews, Uploads | covered |
| Admin (products/categories/inventory/users/orders/reviews/coupons/stats/analytics/audit/admins) | covered |
| Admin system settings (`/admin/settings*`, SUPER_ADMIN) | covered |

Common shapes are defined once under `components`: `SuccessEnvelope`,
`ErrorEnvelope`, `PaginationMeta`, and reusable error responses.

## Pagination envelope key

Paginated list responses use a **top-level `pagination` key**
(`{ success, data, pagination }`) — matching every list controller and the
client's `hasPagination()` guard. `PaginationMeta` is always referenced as
`pagination:` in this spec; `tests/unit/docs/openapi-pagination.test.ts`
guards against regressing to the previously documented `meta` key.
