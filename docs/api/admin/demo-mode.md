# Public demo mode (read-only admin showcase)

Optional, env-gated mode that lets unauthenticated visitors explore the admin
console read-only. Pair with the client build flag `NEXT_PUBLIC_DEMO_MODE` (see
the client repo's `src/lib/demo.ts` + task T41).

## Activation

```
ENABLE_DEMO_MODE=true   # backend env, strict "true"/"false", default "false"
```

When `false` (default), nothing changes: every `/admin/*` request requires an
authenticated `ADMIN`/`SUPER_ADMIN` session exactly as before.

## What a demo visitor (no session cookie) gets while the flag is on

| Request | Behavior |
| --- | --- |
| `GET/HEAD /admin/<safe section>` | **200** — served with a synthetic read-only principal; response PII is masked (below) |
| Any mutating method (`POST/PATCH/PUT/DELETE`) | **403** `Demo mode is read-only` — rejected before routers and the audit middleware run |
| `GET /admin/settings/*` | **403** `Not available in demo mode` (payment/email/provider secrets) |
| `GET /admin/admins/*` | **403** (internal staff accounts + activity) |
| `GET /admin/audit` | **403** (governance trail: actors, IPs, payloads) |
| `GET …/uploads/imagekit-auth` | **403** (signed upload credentials are privileged tokens) |

Sessions work normally: a real admin signing in during demo mode gets full
access — the demo middleware defers every request that carries a session
cookie to the standard authentication flow.

## Mechanics (for reviewers)

- `src/middleware/demoMode.ts` — `demoAdminAccess` (admission) and
  `demoResponseSanitizer` (response masking), mounted in
  `src/routes/v1/index.ts` before the admin routers and `auditAdminMutations`.
- `src/middleware/authentication.ts` — unauthenticated safe-method requests
  flagged `isDemoPublicRead` are admitted with `demoPublicPrincipal`
  (`role: SUPER_ADMIN`, internal `id: -1` so any accidental write fails its FK).
  The method is re-checked here; no session row, cookie, or DB access.
- CSRF is unaffected: tokens are session-bound and anonymous requests skip
  CSRF validation (`skipCsrfProtection`), and demo visitors never mutate.

## Response masking

`demoResponseSanitizer` recursively masks exact keys on every JSON demo
response (lists, details, aggregates):

| Keys | Mask |
| --- | --- |
| `email`, `customer_email` | `a***@***.***` (first local-part char kept) |
| `phone`, `phone_number`, `contact_phone` | `***` + last 4 digits |
| `first_name`, `last_name`, `customer_name`, `recipient_name` | first char + `***` |
| `address_1`, `address_2`, `address_line_1/2`, `street`, `postal_code`, `zip_code` | `***` |

`city`, `state`, `country` and all business data (products, orders, money,
statuses, aggregates) stay intact so the demo reads realistically.
Exact-key matching only — product/category `name` fields are never masked.
`/admin/stats` and `/admin/analytics` payloads contain no customer PII.

## Verification checklist

- Anonymous `GET /admin/products` → 200 (customer/order PII masked).
- Anonymous `POST /admin/products` → 403; no audit row is written.
- Anonymous `GET /admin/settings` → 403.
- Anonymous `GET /admin/analytics` → 200 (aggregates; super-admin surface).
- With a real admin session: full read/write access, no masking.
- Demo off (default): unchanged behavior everywhere.

Unit tests: `tests/unit/middleware/demoMode.test.ts` (13 tests, no DB).
