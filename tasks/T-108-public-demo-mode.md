# T-108 — Public read-only demo mode (recruiter showcase)

**Status:** done
**Priority:** P3 (product)
**Branch:** feature/public-demo-mode

## Goal

Let recruiters and visitors open the admin dashboard directly (`/admin`) without
signing in and explore the real console against the real (seeded) data — with
zero ability to mutate anything, enforced server-side.

## Decisions

- **Env-gated, not always-on**: `ENABLE_DEMO_MODE` (`"true"`/`"false"`, default
  `"false"`). Real deployments stay locked; a demo deployment flips the flag.
  Real admin sessions keep full access while the flag is on.
- **Mechanism**: a `demoAdminAccess` middleware mounted on `/admin` before the
  audit middleware:
  - session cookie present → normal authentication flow (untouched);
  - no cookie + write method → `403 Demo mode is read-only` (mutations can
    never be public, in any mode);
  - no cookie + sensitive section → `403 Not available in demo mode`
    (`/settings` provider secrets, `/admins` staff accounts, `/audit` trail,
    any `imagekit-auth` signed-upload credentials);
  - no cookie + GET/HEAD → `req.isDemoPublicRead = true`.
- **Synthetic principal**: `authentication.ts` admits flagged unauthenticated
  safe-method requests with `demoPublicPrincipal` (`role: SUPER_ADMIN` so
  aggregate super-admin surfaces — Analytics, Reports — are part of the demo;
  internal `id: -1` so an accidental DB write fails its FK). No session row is
  created, no cookie is issued, no DB lookup happens. The method is re-checked
  here as defense in depth.
- **PII masking**: `demoResponseSanitizer` wraps `res.json` for demo reads and
  recursively masks exact keys: `email`/`customer_email` (first char of local
  part), phone fields (last 4), personal names (`first_name`, `last_name`,
  `customer_name`, `recipient_name`), street/postal lines (`***`).
  `city`/`state`/`country` stay visible (weakly identifying, needed for a
  realistic shipping demo). Exact-match keys only — product/category `name`
  fields are never touched. Stats/Analytics responses contain no customer PII.
- **Client side** (`NEXT_PUBLIC_DEMO_MODE` build flag, paired): admin gate lets
  anonymous visitors through, session context elevates UI visibility, a demo
  banner + badge are shown, private nav sections are hidden, mutation triggers
  are hidden across admin surfaces, and the axios layer hard-blocks
  `/admin/*` writes for visitors so a demo client never even issues one.
- Private sections (System settings, Admins, Audit) deep-link to a
  "not available in demo" card instead of an error state.

## Contract

- `GET /api/v1/admin/*` (safe methods, no session, demo on): 200 with masked
  PII; blocked sections → 403.
- Any mutating method without a session, demo on: 403 before routers/audit.
- Demo off: behavior byte-identical to before (default flag is `false`).

## Tests

`tests/unit/middleware/demoMode.test.ts` (13 tests, no DB):
admission on/off, write-method 403s, sensitive-path 403s (settings/admins/
audit/imagekit-auth), cookie passthrough, response masking (nested, envelope
preserved, null/non-string safe), synthetic-principal admission, unauthorized
401 without the flag, and no demo admission for write methods even if flagged.
