# T-080 — Document the REVIEWS_REQUIRE_PURCHASE flag state

| Field | Value |
|-------|-------|
| **ID** | T-080 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `docs` |
| **Branch** | `docs/reviews-purchase-flag` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

`REVIEWS_REQUIRE_PURCHASE = false` ships by default (`src/shared/constants/index.ts:55`) while the enforcement logic is fully implemented (`review.service.ts:132-142`, `review.repository.ts:215-232`). Nothing in OPERATIONS/API docs states the gate exists but is off — reviewers/operators may assume purchase verification is active.

## Goal

Flag state and flip procedure documented.

## Scope

- Note in `docs/api/reviews/reviews.md` (business rules) + `docs/OPERATIONS.md`: current value, what enabling does, test implications.
- Optionally surface in APIDOG testing notes.

## Acceptance criteria

- [ ] Both docs mention the flag with its current state.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.4
