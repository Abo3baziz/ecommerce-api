# T-100 — System settings DB (Prisma model, migration, seed, encryption)

| Field | Value |
|-------|-------|
| **ID** | T-100 |
| **Priority** | P1 |
| **Status** | done |
| **Type** | `feature` |
| **Branch** | `feature/system-settings` |
| **Depends on** | T-047 (baseline migrations), T-088..T-099 (reports) |
| **Blocks** | T-101, T-102, T-103, T-104, T-105, T-106 |

## Problem

No persisted system settings exist. `src/shared/constants/index.ts:12` hardcodes `FLAT_SHIPPING_FEE`, `FREE_SHIPPING_THRESHOLD`, `PAGINATION`, `ADMIN_INACTIVE_AFTER_DAYS`, token TTLs, etc. Requirement §11 demands SUPER_ADMIN-persisted settings loaded from DB, 9 sections, encrypted secrets, audited.

## Goal

Create `system_settings` table (keyed by section), migration, Prisma client regeneration, seed defaults from current constants, and `SETTINGS_ENCRYPTION_KEY` env wiring for payment/email secrets.

## Scope

- Prisma `schema.prisma:520` — `model system_settings { id Int @id @default(autoincrement()); key String @unique @db.VarChar(100) @map("key"); value Json @db.JsonB; updated_at DateTime @updatedAt @db.Timestamptz(6) @map("updated_at"); updated_by Int? @map("updated_by"); users users? @relation(fields:[updated_by], references:[id]); @@index([key]); @@map("system_settings") }` + `users` back-relation.
- Migration `20260831xxxxxx_add_system_settings` — follow baseline naming (`fk_system_settings_updated_by`, `idx_system_settings_key`).
- `src/config/env.ts:10` — `SETTINGS_ENCRYPTION_KEY` `z.string().length(64).regex(/^[0-9a-fA-F]{64}$/)` optional in dev, required in prod if secrets configured. Boot guard if missing when payment/email secrets present.
- Seed: `prisma/seed.ts` or migration `INSERT` populating 9 keys (`general`, `commerce`, `payment`, `shipping`, `email`, `customer`, `security`, `admin_permissions`, `financial`) from `src/shared/constants/index.ts` defaults; idempotent `ON CONFLICT (key) DO NOTHING`.
- Helper `src/modules/settings/utils/encryption.ts` — `aes-256-gcm` encrypt/decrypt with `keyVersion` metadata; never log plaintext.

## Acceptance criteria

- [ ] `npx prisma migrate dev` creates `system_settings` with `key` unique, `value` jsonb, `updated_by` FK.
- [ ] `npx prisma generate` succeeds; `prisma.system_settings.findUnique` type-safe.
- [ ] Seed inserts 9 rows; `SELECT * FROM system_settings` returns defaults.
- [ ] Missing row falls back to constants in service (no crash).
- [ ] `npm run typecheck` green; no `npm test` against dev DB.

## References

- `prisma/schema.prisma:520`, `prisma.config.ts:1`, `src/config/database.ts:1`, `src/config/env.ts:1`, `src/shared/constants/index.ts:12`, `src/shared/utils/index.ts:1`, `docs/ARCHITECTURE.md:1`
