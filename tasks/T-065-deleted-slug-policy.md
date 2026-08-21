# T-065 — Soft-deleted slug/name reservation policy + admin detail mismatch

| Field | Value |
|-------|-------|
| **ID** | T-065 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `bugfix` |
| **Branch** | `bugfix/deleted-slug-policy` |
| **Depends on** | T-047 preferred (partial indexes) |
| **Blocks** | — |

## Problem

`findBySlug`/`findByName` ignore `deleted_at` and uniques are global (`product.repository.ts:197-205`, `category.repository.ts:146-164`): soft-deleted rows permanently reserve slugs/names; an explicit slug colliding with an invisible deleted product returns 409 with confusing copy. Also mismatch: admin LIST with `include_deleted=true` returns deleted products, but `getAdminProduct` requires `deleted_at: null` → 404 on a listed row (`product.repository.ts:133-161` vs `278-292`).

## Goal

Documented slug lifecycle; admin list/detail consistent.

## Scope

- Decide: partial unique indexes `WHERE deleted_at IS NULL` (reuse after deletion) vs keep-reserved-forever policy.
- Allow admin detail fetch of soft-deleted records when `include_deleted` semantics apply.
- Improve conflict messages to distinguish live vs reserved-by-deleted collisions.

## Acceptance criteria

- [ ] Policy implemented + documented; list/detail consistent for deleted rows.
- [ ] Tests for reuse-after-delete (if adopted).

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.4
