# Ecommerce Backend API

A production-deployed REST API powering a full e-commerce platform — customer
accounts, catalog with variants and images, inventory, carts, transactional
checkout, orders with a status-transition state machine, reviews, coupons,
analytics, financial PDF reports and an append-only audit trail — plus the
administration surface behind it all.

**Part of a full-stack app** · [View Portfolio](https://codebyahmed.online)

| | |
|---|---|
| **Live API** | [ecommerce-api-l3a4.onrender.com](https://ecommerce-api-l3a4.onrender.com/health) |
| **Storefront (frontend repo)** | [github.com/Abo3baziz/ecommerce-client](https://github.com/Abo3baziz/ecommerce-client) · [live](https://ecommerce-storefront-ashy.vercel.app) |
| **API contract** | [openapi/openapi.yaml](openapi/openapi.yaml) (OpenAPI 3.1, 77 paths) · human-readable specs in [`docs/api/**`](docs/api) |
| **Portfolio** | [codebyahmed.online](https://codebyahmed.online) |

## Feature surface (~77 endpoints under `/api/v1`)

| Module | Highlights |
|---|---|
| **Auth & sessions** | Opaque DB-backed session tokens (hashed with a server-side pepper), HttpOnly/SameSite cookies, CSRF double-submit on all writes, email verification, password reset via emailed OTP, brute-force lockout, per-device session revocation |
| **Catalog** | Products with soft delete, variants (SKU/barcode/dimensions/discounts), images ordered by `display_order` with an exactly-one-primary invariant, category assignment |
| **Inventory** | Per-variant stock ledger with reservation semantics (`reserveStock`/`commitStock`/`releaseStock` order operations), manual admin reserve/release |
| **Cart & checkout** | Lazily created cart, live server-side pricing, single-transaction checkout guarded by a per-user advisory lock (stock reserve → payment → snapshot → cart clear) |
| **Orders** | Immutable item snapshots (price/name/SKU frozen at checkout), strict legal status-transition matrix with asserted side effects (ship creates shipment, cancel restocks, refund marks payment refunded), coupon redemption inside the same transaction |
| **Reviews** | Purchase-gated, one live review per user per product, image provenance validated against the ImageKit host, rating summaries |
| **Reports** | Financial PDFs — P&L Statement, Expenses and Revenue by `month|quarter|year|custom` (≤366d) with configurable currency (`USD|EUR|GBP|EGP|SAR|AED`), vector charts (line/bar/pie via `pdfkit`), `SUPER_ADMIN`-only `attachment|inline` download or `?format=json` preview |
| **Admin** | Role matrix (`CUSTOMER`/`ADMIN`/`SUPER_ADMIN`), dashboard stats, P&L analytics with expenses ledger, coupon management, moderation queue, customer account administration, append-only audit log |

## Architecture decisions worth noting

- **Money is never a float** — every monetary value is a `Decimal(10,2)`
  column serialized as a string end-to-end; arithmetic is decimal-based.
- **Checkout correctness** — duplicate/concurrent checkouts can't double-charge
  or oversell: per-user advisory lock + affected-row-count assertions inside the
  transaction abort on any mismatched precondition.
- **Provider-agnostic payments** — checkout depends on a `PaymentGateway`
  interface; v1 ships a synchronous mock provider.
- **Security posture** — helmet, global + endpoint-specific rate limiting
  (proxy-aware via `TRUST_PROXY`), Zod validation at the route boundary,
  structured logging with secret redaction, health/readiness probes outside
  the limiter.
- **PDFs without native deps** — financial reports stream `application/pdf`
  via pure `pdfkit` vector drawing (tables + line/bar/pie), `Cache-Control: no-store`,
  `Content-Disposition: attachment|inline` and `X-Report-Currency`; no Chromium/`canvas` required.
- **Documented like a public API** — every module has a hand-maintained
  contract in `docs/api/**` (the source of truth), mirrored into OpenAPI 3.1
  for Apidog/Postman import and client generation.

## Tech stack

| Concern | Choice |
|---|---|
| Runtime | Node.js, TypeScript (strict), ESM |
| HTTP | Express 5 |
| ORM / DB | Prisma 7 + PostgreSQL (driver adapter `@prisma/adapter-pg`) |
| Auth | Cookie sessions, `csrf-csrf`, bcrypt |
| Email / Images | Resend · ImageKit (signed direct browser uploads) |
| PDF Reports | `pdfkit` — vector tables + line/bar/pie charts, `Intl.NumberFormat` currency |
| Validation | Zod schemas shared by route validators |
| Logging | pino (structured, redacted) |
| Testing | Vitest — unit, integration and e2e suites (~1,100 tests) |

## Local development

```bash
npm install          # postinstall runs prisma generate
npm run dev          # http://localhost:3000 (frontend owns 3001)
npm run typecheck    # tsc --noEmit
npm run build        # esbuild bundle -> dist/index.js
```

Copy [`.env.example`](.env.example) → `.env` and fill in Postgres, Resend and
ImageKit credentials. Migrations:

```bash
npm run db:migrate           # dev
npm run db:migrate:deploy    # production/release
```

Bootstrap the first administrator after registering through the storefront:

```bash
npm run admin:create         # prompts for email, promotes to SUPER_ADMIN
```

> ⚠️ Never run `npm test` against your development or production database —
> integration suites clean up test data aggressively. Use `.env.test`.

## Deployment

Render (API) → Neon PostgreSQL, with the Vercel-hosted storefront proxying
browser traffic same-origin so session cookies stay first-party. Release
command applies migrations before boot; `/health/ready` is the platform probe.
Full runbook: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

© Ahmed Abdelaziz · [Portfolio](https://codebyahmed.online)
