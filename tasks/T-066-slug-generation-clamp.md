# T-066 — Slug generation: clamp length, non-Latin policy

| Field | Value |
|-------|-------|
| **ID** | T-066 |
| **Priority** | P3 |
| **Status** | todo |
| **Type** | `bugfix` |
| **Branch** | `bugfix/slug-generation-edges` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

`slugify` strips everything outside `[a-z0-9]` (`products/utils/slug.ts`, `categories/utils/slug.ts`). Two verified edges:

- A ~253+ char base plus `-2/-3…` suffix exceeds `slug VarChar(255)` → uncaught P2000 → 500 on create.
- Pure CJK/Arabic/Cyrillic names always yield an empty slug → outright 400; non-Latin catalogs unusable without transliteration policy.

## Goal

Slug generation never 500s and has a documented non-Latin story.

## Scope

- Clamp base length leaving suffix headroom before the uniqueness loop.
- Product decision: transliteration library vs manual-slug-required flow for non-Latin names (validator message updated accordingly).

## Acceptance criteria

- [ ] Max-length names create fine with suffixing.
- [ ] Non-Latin behavior per chosen policy with clear validation errors.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.4
