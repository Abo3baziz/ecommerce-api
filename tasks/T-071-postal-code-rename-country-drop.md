# T-071 — Address field naming: postal_code rename + drop country

| Field | Value |
|-------|-------|
| **ID** | T-071 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `refactor` |
| **Branch** | `refactor/postal-code-rename` |
| **Depends on** | T-030 (width alignment first), T-047 (migration) |
| **Blocks** | — |

## Problem

The same real-world concept uses two names: `user_addresses.zip_code` vs `shipments.postal_code` (schema.prisma:420/400), exposed as `zip_code` in the addresses DTO (`addresses/dto/address.ts:16, 25`) and documented with a mapping note in the orders doc. Separately, `ENHANCEMENTS.md` requests dropping `country` entirely (Egypt-only delivery).

## Goal

One vocabulary for postal codes; country field removed per product decision.

## Scope

- Rename `user_addresses.zip_code` → `postal_code` (column + DTO + docs + tests), or alias at DTO level short-term.
- Drop `country` from validators/DTO/UI payloads; keep column if historical data requires, else migrate out (T-047).
- Update `docs/api/users/addresses.md`, orders shipping-address mapping notes, APIDOG guide.

## Acceptance criteria

- [ ] Single field name across API surface; country gone from contracts.
- [ ] Breaking-change note recorded; tests updated.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.4
- Source request: `ENHANCEMENTS.md`
