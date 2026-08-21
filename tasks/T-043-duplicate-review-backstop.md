# T-043 — Duplicate-review DB backstop (partial unique index)

| Field | Value |
|-------|-------|
| **ID** | T-043 |
| **Priority** | P2 |
| **Status** | todo |
| **Type** | `bugfix` |
| **Branch** | `bugfix/duplicate-review-backstop` |
| **Depends on** | T-047 |
| **Blocks** | T-045 (summary correctness depends on no duplicates) |

## Problem

Duplicate-review prevention is a check-then-insert (`src/modules/reviews/service/review.service.ts:123-130`) with no `@@unique([users_id, products_id])` on `reviews` (schema.prisma:334-355). Two concurrent POSTs by the same user both pass → duplicate approved reviews skewing `summary.average_rating`/counts; spam vector.

## Goal

One live review per user per product, enforced by the database.

## Scope

- Partial unique index `(users_id, products_id) WHERE deleted_at IS NULL` — preserves current re-review-after-deletion behavior.
- Catch P2002 → 409 with the existing duplicate message.
- Keep soft-delete + re-create flow working.

## Acceptance criteria

- [ ] Concurrent duplicate creates: exactly one succeeds; other 409.
- [ ] Delete-then-recreate still allowed.
- [ ] Suite green.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.4
