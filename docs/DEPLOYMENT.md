# Deployment & Operations Runbook

> Production cutover checklist and incident-response baseline for the Ecommerce Backend API.
>
> Companion docs: [OPERATIONS.md](OPERATIONS.md) (operator CLIs), [LOGGER.md](LOGGER.md) (log architecture), [TESTING.md](TESTING.md) (test environment).

---

# 1. Environment & Secrets Inventory

All variables are validated at boot by `src/config/env.ts` — the process exits if any are missing.

| Variable | Purpose | Rotation impact |
| --- | --- | --- |
| `NODE_ENV` | Must be `production` in prod | — |
| `PORT` | Listen port | restart |
| `DATABASE_URL` | Postgres connection string | restart; see §3 |
| `SESSION_SECRET` | Session token hashing pepper | **invalidates all sessions** on change |
| `CORS_ORIGIN` | Allowed browser origin(s) | restart |
| `TRUST_PROXY` | Client-IP resolution behind a proxy — see [OPERATIONS.md → Reverse Proxy](OPERATIONS.md) | restart |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Transactional email | restart |
| `IMAGEKIT_PUBLIC_KEY` / `IMAGEKIT_PRIVATE_KEY` / `IMAGEKIT_URL_ENDPOINT` | Upload auth signatures + URL validation | restart; old signatures valid until expiry (~30 min) |
| `RATE_LIMIT_MAX`, `LOGIN_RATE_LIMIT_MAX`, `REGISTER_RATE_LIMIT_MAX` | Rate-limit tuning | restart |
| `ENABLE_CSRF` | **Must be unset/true** — production boot fails when disabled | — |
| `LOG_LEVEL` | Log verbosity | restart |

## Secrets rotation procedure

1. Rotate the upstream secret first (DB password, Resend key, ImageKit key) so the old value is dead.
2. Update the platform secret store (systemd env file, container secret, hostinger/VPS panel, …).
3. Restart the service (`systemctl restart …` / redeploy).
4. Verify: `/health` returns 200, login works, an upload-auth request signs successfully.
5. Special cases:
   - `SESSION_SECRET` rotation logs every user out — announce beforehand.
   - DB password rotation must be coordinated with connection-pool drain (restart immediately after).

---

# 2. Process Model

The app is a single Node process (`npm run build` → `node dist/index.js`).

- **systemd** (recommended on a VPS): unit with `Restart=always`, `RestartSec=3`, `EnvironmentFile=/etc/ecommerce/api.env`. Logs go to stdout → journald.
- **PM2**: `pm2 start dist/index.js --name api && pm2 save`; use `pm2 startup` for boot persistence.
- **Containers**: one process per container; orchestration handles restarts.
- **Zero-downtime:** not yet supported (graceful shutdown tracked as T-053). Accept ~1–3s of dropped in-flight requests per deploy; deploy during low traffic. Blue-green with two ports behind nginx is the manual workaround.

## Multi-instance caveats

- **Sessions live in Postgres**, so horizontal scaling of the stateless API is safe for auth.
- **Rate limiting is in-memory per instance** (express-rate-limit default). Behind N instances each has its own bucket, so effective limits multiply by N. Mitigations: (a) run one API instance behind the proxy, (b) switch to the Redis store (`@rate-limiter/redis`) before scaling beyond one instance, or (c) divide `RATE_LIMIT_MAX` by expected instance count as a stopgap.
- File-based logs (`logs/app.ndjson`) are per-instance — ship stdout to a central sink instead of tailing files.

---

# 3. Database Backups & Restore Drill

## Backup

Nightly logical dump, retained ≥ 7 days:

```bash
pg_dump "postgresql://USER:PASSWORD@HOST:5432/DBNAME" \
  --format=custom --file=/backups/ecommerce-$(date +%F).dump
# verify it is non-empty and restorable-looking
ls -la /backups/ && pg_restore --list /backups/ecommerce-$(date +%F).dump >/dev/null && echo OK
```

Off-site copy (object storage or another host) — a backup that lives only on the DB server does not survive that server.

## Restore drill (run quarterly)

```bash
createdb ecommerce_restore_drill
pg_restore --dbname=ecommerce_restore_drill /backups/<latest>.dump
psql ecommerce_restore_drill -c 'SELECT count(*) FROM "Ecommerce"."users";'
dropdb ecommerce_restore_drill
```

The drill only passes if row counts look sane. Never restore over production without stopping the API.

## Migrations

```bash
npm run build
npx prisma migrate deploy   # applies pending migrations only
systemctl restart ecommerce-api
```

Take a fresh backup immediately before running migrations. `migrate dev` is a development-only command — never on production.

---

# 4. Health Checks & Monitoring

## Liveness


Two probes, both outside the rate limiter:

- `GET /health` — liveness: static `{ "status": "ok" }`; process is up.
- `GET /health/ready` — readiness: runs a 2s-timeout `SELECT 1`; returns 200 when the DB answers and **503** `{ "status": "degraded", "db": "down" }` on outage. Point load-balancer removal and alerts at this one.

Configure:

- systemd-level restart on crash (`Restart=always`).
- External uptime probe every 60s against `https://<host>/health`, alerting after 3 consecutive failures (UptimeRobot/Pingdom or equivalent).

## Baseline alerting

| Signal | Source | Alert threshold |
| --- | --- | --- |
| 5xx rate | log shipping or access log | > 5% over 5 min |
| Error log entries | `logs/app.ndjson` level=error shipped to sink | any sustained burst |
| Disk full (kills writes/logs) | node exporter / panel metric | > 80% |
| DB connections | `SELECT count(*) FROM pg_stat_activity;` | near pool limit |
| Certificate expiry | probe tool | < 14 days |

Minimum viable setup: uptime probe + daily disk check + weekly review of error-rate trends from shipped logs.

---

# 5. Pre-Cutover Checklist

- [ ] `NODE_ENV=production` set; app boots with compiled artifact (`npm run build && node dist/index.js`)
- [ ] All secrets from §1 set in the platform store; `.env*` files absent from the server image/repo checkout
- [ ] CSRF enabled (default); `ENABLE_CSRF` not set to false
- [ ] HTTPS terminated; `TRUST_PROXY` configured per topology (see OPERATIONS.md)
- [ ] `prisma migrate deploy` clean against production DB
- [ ] Nightly backup job scheduled + one successful restore drill completed
- [ ] Uptime probe + alert channel wired
- [ ] Rate limits reviewed for real traffic profile (defaults: global 100/15min, login 10/15min)
- [ ] Admin account created via `npm run admin:create` (see OPERATIONS.md), super-admin verified
- [ ] Session cleanup cron installed (see OPERATIONS.md → Session Cleanup Job)
- [ ] Smoke test: register → verify email (arrives via Resend) → login → browse catalog → cart → mock checkout → order visible

---

# 6. Incident Response Basics

1. **Stabilize:** restart service (`systemctl restart …`) if degraded; roll back to previous deployment artifact if a recent deploy is suspected.
2. **Triage:** check uptime probe history → journald/stdout errors → `logs/app.ndjson.<n>` around the onset window. Correlate by `requestId`.
3. **Database incidents:** never run destructive SQL under pressure. Take an immediate `pg_dump` snapshot before schema/data interventions.
4. **Suspected credential leak:** rotate `SESSION_SECRET` (kills sessions), rotate affected provider keys (§1 procedure), review audit-log table for admin actions.
5. **Abuse/spike:** lower `RATE_LIMIT_MAX`/login limits and restart; block offender IPs at the proxy; confirm limiter keying via TRUST_PROXY section.
6. **Postmortem:** timeline, root cause, action items filed as tasks in `tasks/`.

Escalation contacts and hosting credentials belong in the operator's password manager — never in this repository.

---

# 7. PaaS Deployment — Railway/Render (API) + Vercel (Storefront)

The supported split-hosting topology keeps browser traffic **same-origin** via the
frontend's rewrite proxy, so `SameSite=Lax` session cookies work without any code
changes:

```
Browser ──► Vercel (storefront)
              │  same-origin /api/v1/* requests
              ▼  next.config.ts rewrites ──► Railway/Render (this API) ──► managed Postgres
```

## API service (Railway / Render / Fly)

- **Build command:** `npm ci && npm run build` (`postinstall` runs `prisma generate`,
  so the generated client exists before `tsc`).
- **Start command:** `npm run db:migrate:deploy && npm start` — applies pending
  migrations, then boots `dist/index.js`.
- **Health check:** point the platform probe at `/health/ready` (200 = DB reachable,
  503 = degraded). `/health` is liveness only.
- **Env vars:** copy `.env.example` into the platform secret store. The two that
  must match the frontend are:
  - `CORS_ORIGIN` = the exact storefront origin (e.g. `https://app.vercel.app`),
    no trailing slash. It drives CORS **and** every link inside transactional
    emails (`/verify-email`, `/reset-password`, `/verify-email-change`), which is
    why it must be the *public site* URL, not the API URL.
  - `TRUST_PROXY=1` — one proxy hop (platform edge); otherwise rate limiting and
    logs key on the proxy IP.
- `PORT` is injected by the platform and picked up automatically.
- In-memory rate limiting is per-instance — scale to **one** API instance or add a
  shared store first (see §2 Multi-instance caveats).

## Storefront (Vercel)

- Env vars:
  - `NEXT_PUBLIC_API_BASE_URL=/api/v1` (relative — browser stays same-origin;
    cookies remain first-party, no CORS involved for browser calls).
  - `API_ORIGIN=https://<your-api>.up.railway.app` (no trailing slash) — used
    server-side by `next.config.ts` rewrites.
- Deploy with defaults (`next build`); rewrites run on Vercel's edge/server side.

## Post-deploy smoke test

1. `GET https://<api>/health` → 200; `GET /health/ready` → 200.
2. Register → verification email arrives with links pointing at the storefront origin.
3. Login → browse → cart → mock checkout → order visible; CSRF round-trip works
   through the proxy (writes succeed without manual token handling).
