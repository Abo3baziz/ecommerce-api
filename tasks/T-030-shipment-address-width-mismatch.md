# T-030 — Fix checkout 500 from shipment address column-width mismatch

| Field | Value |
|-------|-------|
| **ID** | T-030 |
| **Priority** | P1 |
| **Status** | done |
| **Type** | `bugfix` |
| **Branch** | `bugfix/shipment-address-width` |
| **Depends on** | — |
| **Blocks** | T-071 (naming rename should land after widths aligned) |

## Problem

Address validators allow `address_1`/`address_2` up to 255 chars (`src/modules/addresses/validators/address.ts:9-10`) but `shipments.address_1`/`address_2` are `VarChar(100)` (`prisma/schema.prisma:398-399`). Checkout copies the saved address verbatim into the shipment snapshot (`src/modules/orders/service/orders.service.ts:263-276`) → Postgres error 22001 → opaque 500 for any user with a >100-char address line. Revenue path dead for affected users.

## Goal

Checkout never fails due to address length; failures become validation errors, not 500s.

## Scope

- Decide alignment direction: cap address validator at 100 (matches shipments) or widen shipment columns to 255 (migration needed — coordinate with T-047).
- Validate lengths at checkout so a legacy over-long address yields 400/409 with actionable message instead of 500.
- Regression test: save max-length address → checkout succeeds (or fails with 4xx).

## Acceptance criteria

- [ ] No Postgres 22001 reachable from checkout.
- [ ] Validator limits and column widths agree (documented which side is source of truth).
- [ ] Tests green.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.3
- Related: T-071 (zip_code/postal_code naming)

## Implementation notes (2026-08-21 — awaiting commit/merge)

- Decision: align the validator to the narrowest consumer (shipments VarChar(100)); no schema change pre-T-047.
- Added `ADDRESS_LINE_MAX_LENGTH = 100` to `src/shared/constants/index.ts`; addresses validators (`address_1`/`address_2`) now use it instead of 255.
- All other address fields already matched both tables' widths (verified recipient_name/phone/country/state/city/zip vs `user_addresses` + `shipments`).
- Checkout guard in `placeOrder` right after address fetch: legacy rows with >100-char lines now fail with 400 `BadRequestError` ("The selected address exceeds the maximum allowed length…") instead of Postgres 22001 → 500; transaction aborts before any writes/reservations.
- Tests: boundary case (100-char `address_1` + `address_2` → checkout succeeds, snapshot lengths asserted) and legacy-row rejection (101-char via direct factory insert → BadRequestError, stock untouched, no order row). `createCheckoutContext` gained an `addressOverrides` param.
- Docs: `docs/api/users/addresses.md` field limits updated to 100 + design-decision note about the shipments snapshot bound and checkout re-validation.
- Verified: orders integration + addresses unit suites green (81 tests); full suite **63 files / 1046 tests**; typecheck + build pass.
