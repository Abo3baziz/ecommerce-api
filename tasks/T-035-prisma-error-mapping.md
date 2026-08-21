# T-035 — Global Prisma error mapping in the error handler

| Field | Value |
|-------|-------|
| **ID** | T-035 |
| **Priority** | P2 |
| **Status** | todo |
| **Type** | `refactor` |
| **Branch** | `refactor/prisma-error-mapping` |
| **Depends on** | — |
| **Blocks** | T-040, T-041, T-042, T-043, T-064 (race fixes lean on this) |

## Problem

`errorHandler` maps only `AppError`; everything else → generic 500 (`src/middleware/errorHandler.ts:12-23`). The only `PrismaClientKnownRequestError` handling in the codebase is ad-hoc in `inventory.service.ts:154-163`. Verified race sites that surface as 500s instead of 4xx:

- Register duplicate email/phone TOCTOU → P2002 → 500 instead of 409 (`auth.service.ts:45-53`)
- Admin/user profile email/phone updates → P2002 (`admin.service.ts:94-108`, `users.service.ts:134-138, 189-193`)
- Product/variant/category duplicate slug/SKU/name races → P2002 (`product.service.ts`, `variant.service.ts`, `category.service.ts`)
- Category assign PUT race → P2002 on a contract that promises idempotent 204 (`category.service.ts:298-305`)
- Stale-ID updates / vanished records → P2025 → 500 instead of 404/409

## Goal

Recoverable conflicts never surface as 500; one central mapping.

## Scope

- Map in `errorHandler`: P2002 → 409 Conflict (generic message), P2025 → 404 Not Found; keep the inventory ad-hoc mapping or migrate it.
- Optionally map common Postgres codes (22001 string-too-long → 400).
- Keep module-specific conflict *messages* where they add value (catch locally first, fall through to global).

## Acceptance criteria

- [ ] Concurrency tests for register/slug/assign paths return 4xx, not 500.
- [ ] No duplicated P2002 catch blocks left behind except where messages differ deliberately.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.2/§4.3/§4.4
