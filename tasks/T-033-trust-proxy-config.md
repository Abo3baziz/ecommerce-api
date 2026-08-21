# T-033 — Configure trust proxy for correct client IPs

| Field | Value |
|-------|-------|
| **ID** | T-033 |
| **Priority** | P1 |
| **Status** | todo |
| **Type** | `bugfix` |
| **Branch** | `bugfix/trust-proxy` |
| **Depends on** | — |
| **Blocks** | T-029 (limiter keying correctness) |

## Problem

No `app.set("trust proxy", …)` anywhere. express-rate-limit keys on `req.ip` = socket peer, so behind nginx/LB/PaaS: (a) all clients share one 100 req/15min bucket → platform-wide self-DoS; (b) request logs and `sessions.ip_address` record the proxy IP for everyone.

## Goal

Client IP resolution is correct for the deployed topology.

## Scope

- Make trust proxy configurable via env (e.g. `TRUST_PROXY` accepting hop count or CIDR list), default off for direct exposure.
- Set it in `src/app/index.ts` before middleware registration.
- Verify express-rate-limit v8 + helmet compatibility; document per-topology values in `docs/OPERATIONS.md`.

## Acceptance criteria

- [ ] Behind a proxy, limiters key on real client IP; logs/sessions record it.
- [ ] Direct deployment unchanged.
- [ ] Ops docs updated.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.5
- `src/app/index.ts`, `src/middleware/rateLimiter.ts`
