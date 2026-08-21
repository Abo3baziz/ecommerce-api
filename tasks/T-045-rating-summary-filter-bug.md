# T-045 — Review summary must ignore the rating filter

| Field | Value |
|-------|-------|
| **ID** | T-045 |
| **Priority** | P2 |
| **Status** | todo |
| **Type** | `bugfix` |
| **Branch** | `bugfix/review-summary-filter` |
| **Depends on** | T-043 (no duplicates) |
| **Blocks** | — |

## Problem

The customer reviews list feeds identical filters — including `rating` — into both the page query and the `_avg/_count` aggregate (`review.service.ts:74-97`, aggregate at `review.repository.ts:364-374`). `GET /products/{id}/reviews?rating=5` returns `summary.average_rating: 5` and `total_count` equal to the number of 5-star reviews only. The summary misrepresents the product's overall rating.

## Goal

Summary always describes all live approved reviews of the product; filters apply to the list only.

## Scope

- Compute summary without the `rating` filter (keep other scoping: product, non-deleted, approval policy).
- Decide + document whether pagination `total` stays filtered (recommended yes).
- Regression test with mixed ratings + `rating=5`.

## Acceptance criteria

- [ ] Summary stable regardless of rating filter.
- [ ] Docs note in `docs/api/reviews/reviews.md`; suite green.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.4
