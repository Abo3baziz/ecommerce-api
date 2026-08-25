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

Common shapes are defined once under `components`: `SuccessEnvelope`,
`ErrorEnvelope`, `PaginationMeta`, and reusable error responses.
