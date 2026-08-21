# T-062 — Orders small hardening batch

| Field | Value |
|-------|-------|
| **ID** | T-062 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `bugfix` |
| **Branch** | `bugfix/orders-small-hardening` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

Three verified robustness gaps in orders/inventory:

1. `releaseStock` result not asserted in the admin PENDING-cancel branch (`orders/service/admin.service.ts:206-215`) — every sibling op uses `assertAffected`; a silent 0-row update would orphan reservations (currently near-unreachable since PENDING never persists, but the invariant should be uniform).
2. Unbounded `search` query length in orders + inventory validators (`validators/common.ts:64`, inventory `common.ts:49`) — multi-KB terms hit ILIKE scans.
3. Payment gateway factory throws bare `Error` (`orders/payment/index.ts:10-15`) — currently unreachable (`payment_method: z.literal("mock")`); when T-002 adds gateways this must stay an internal error while unsupported methods map to 400 at validation.

## Goal

Uniform affected-row assertions; bounded inputs; typed internal errors.

## Scope

- Wrap `releaseStock` with `assertAffected`.
- Add `.max(100)` to both search validators.
- Use an internal AppError subclass for the factory; note validation contract for T-002.

## Acceptance criteria

- [ ] All three fixed with targeted tests; suites green.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.3
