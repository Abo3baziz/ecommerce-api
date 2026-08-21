# T-069 — Barcode uniqueness decision + enforcement

| Field | Value |
|-------|-------|
| **ID** | T-069 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `feature` |
| **Branch** | `feature/barcode-uniqueness` |
| **Depends on** | T-047 preferred |
| **Blocks** | — |

## Problem

Barcode has length-only validation (max 255) with no service-level conflict check and a plain nullable column (`variant.ts:16`; `variant.service.ts:105-120, 159-179`; schema.prisma:274). Duplicates across variants will break any future scan-based lookup. Contrast SKU which is `@unique`.

## Goal

Barcode uniqueness scope decided and enforced.

## Scope

- Product decision: global unique vs per-brand vs none-documented.
- If enforced: nullable `@unique` (Postgres allows multiple NULLs) + P2002 → 409 in create/update.

## Acceptance criteria

- [ ] Chosen policy implemented/documented; conflict path tested if enforced.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.4
