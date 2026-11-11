# ⚙️ Ecommerce Backend API

The engine behind an online store. It handles everything the website needs:
customer accounts, products, stock, shopping carts, checkout, orders,
reviews, coupons, sales reports, store settings and the admin dashboard's
data. The website itself lives in a separate repo.

**Part of a full-stack app** · [View Portfolio](https://codebyahmed.online)

| | |
|---|---|
| 🌐 **Live API** | [ecommerce-api-l3a4.onrender.com](https://ecommerce-api-l3a4.onrender.com/health) |
| 🛍️ **Storefront (frontend repo)** | [github.com/Abo3baziz/ecommerce-client](https://github.com/Abo3baziz/ecommerce-client) · [live](https://ecommerce-storefront-ashy.vercel.app) |
| 📚 **API docs** | [openapi/openapi.yaml](openapi/openapi.yaml) · plain-language specs in [`docs/api/**`](docs/api) |
| 👤 **Portfolio** | [codebyahmed.online](https://codebyahmed.online) |

## 🧩 What it does

| Area | In plain terms |
|---|---|
| 🔐 **Accounts & security** | Sign-up and sign-in with secure cookies, verify your email, reset a forgotten password with a code sent by email, sign out of individual devices, and protection against repeated failed login attempts |
| 🗂️ **Catalog** | Products with soft delete, size/color options (each with its own SKU, barcode and price), photos with one clearly marked main photo, and categories |
| 📦 **Stock** | Tracks stock for every product option; sets stock aside while an order is being placed, and staff can manually hold or release stock |
| 🛒 **Cart & checkout** | The cart is created on demand and always shows live prices; checkout happens as one all-or-nothing step — stock, payment and the order either all succeed or nothing changes |
| 🚚 **Orders** | Once placed, an order's items are frozen (price and name can't drift), and it moves through clear statuses — confirm, ship, deliver, refund — with stock and payments updating automatically. Coupons apply safely inside that same step |
| ⭐ **Reviews** | Only customers who bought a product can review it, one live review per person per product, photos included |
| 📄 **Reports** | Download profit & loss, revenue or expense reports as PDFs, grouped by month, quarter or year, with charts |
| 🧑‍💼 **Admin & settings** | Three roles (customer / staff / owner), a stats dashboard, review moderation, customer administration, a permanent log of every staff action, and store settings — where secrets like mail passwords are encrypted and never displayed |
| 👀 **Demo mode** | Flip one switch and visitors can explore the admin dashboard read-only, without an account — personal details are partly hidden and nothing can be changed |

## 💡 Choices worth knowing about

- 💰 **Money is exact.** Prices are stored and calculated as exact decimal
  values — never the rough floating-point numbers computers usually use — so
  totals are always correct to the cent.
- 🛡️ **Checkout can't be cheated.** Two people paying at the same moment
  can't oversell the last item or get charged twice; every step is checked
  before anything is saved.
- 🔌 **Payments are swappable.** The checkout talks to a payment provider
  through a simple interface; today it ships with a built-in test provider,
  and a real one can be added without touching checkout logic.
- 🔒 **Secrets stay secret.** Sensitive settings (like email passwords) are
  encrypted in the database, always shown masked, and never written to logs.
- 🚦 **Hard to abuse.** Request limits, thorough input checking, and no
  useful details leaked in error messages.
- 📚 **Documented like a public API.** Every endpoint has hand-written docs,
  plus a machine-readable spec for tools like Postman.

## 🧰 Tech stack

| Concern | Choice |
|---|---|
| Runtime | Node.js, TypeScript, Express |
| Database | PostgreSQL with Prisma |
| Auth | Cookie sessions, bcrypt, CSRF protection |
| Email / Images | Resend · ImageKit (photos uploaded straight from the browser) |
| Reports | pdfkit — PDFs with tables and charts |
| Testing | Vitest — around 1,100 automated tests |

## 🚀 Run it locally

```bash
npm install
npm run dev          # http://localhost:3000 (the frontend uses 3001)
npm run typecheck
npm run build
```

Copy [`.env.example`](.env.example) to `.env` and fill in the Postgres,
email (Resend) and image (ImageKit) credentials — the template explains
every field, including a key used to encrypt stored secrets. Then set up the
database:

```bash
npm run db:migrate
```

After registering through the storefront, promote yourself to store owner:

```bash
npm run admin:create    # asks for an email, makes it an admin account
```

> ⚠️ Don't run the automated tests against your real database — they wipe
> test data. They expect a separate `.env.test` database.

## ☁️ Deployment

Runs on [Render](https://render.com) with a Postgres database; the Vercel
storefront sends browser requests through itself so logins keep working
smoothly. Database updates are applied automatically on release, and
`/health/ready` is the uptime probe. Full details:
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

---

© Ahmed Abdelaziz · [Portfolio](https://codebyahmed.online)
