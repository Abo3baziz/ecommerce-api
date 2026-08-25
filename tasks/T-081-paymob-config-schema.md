# T-081 — Paymob config + env schema

| Field | Value |
|-------|-------|
| **ID** | T-081 |
| **Priority** | P0 |
| **Status** | wontfix |
| **Type** | `feature` |
| **Branch** | `feature/paymob-config` |
| **Depends on** | — |
| **Blocks** | T-082, T-083, T-084, T-085 |

## Problem

Checkout only supports the `mock` provider. Paymob credentials, base URL, and
webhook/redirect URLs must be configurable per environment and validated at
boot, without breaking dev/test when the provider is not configured yet.

## Goal

Add a validated Paymob configuration block to the env schema with a runtime
"is configured" guard so the rest of the integration can be built and tested
against mocks before real keys arrive.

## Scope

- Install the Paymob integration agent skill into `~/.agents/skills/paymob-integration`
  from `https://github.com/PaymobAccept/Paymob-AI-Integration-Skill` (clone to temp,
  copy `skills/paymob-integration`, verify `SKILL.md` + `references/*` exist).
  Consult `references/intention-api.md`, `hmac-verification.md`,
  `transaction-inquiry.md`, `advanced-features.md`, `code-nodejs.md` while
  implementing T-081…T-087; cross-check live specs via the skill's `llms.txt`.
- Env vars (all optional, empty by default):
  - `PAYMOB_ENABLED` (`false` default)
  - `PAYMOB_BASE_URL` (default `https://accept.paymob.com`)
  - `PAYMOB_SECRET_KEY` / `PAYMOB_PUBLIC_KEY` / `PAYMOB_API_KEY` / `PAYMOB_HMAC_SECRET`
  - `PAYMOB_INTEGRATION_ID_CARD` / `PAYMOB_INTEGRATION_ID_WALLET`
  - `PAYMOB_NOTIFICATION_URL` (public https webhook URL)
  - `PAYMOB_REDIRECTION_URL` (public https checkout-result URL)
  - `PAYMOB_ORDER_TTL_MINUTES` (default 60)
- Zod schema: when `PAYMOB_ENABLED=true`, require secret/public/api/hmac keys,
  both integration IDs, and absolute https notification/redirection URLs.
- Export `isPaymobConfigured()` helper; checkout with `paymob` while
  unconfigured → `503 ServiceUnavailableError("Payment provider not configured")`.
- Add the vars to `.env.example` (create if missing).
- Tests: config validation unit tests (enabled/disabled/partial).

## Out of scope

- Real network calls to Paymob (T-083).
- Webhook HMAC (T-085).

## Acceptance criteria

- [ ] Boot fails fast on invalid partial Paymob config when enabled.
- [ ] Dev/test boot without any Paymob vars.
- [ ] `isPaymobConfigured()` reflects env correctly.
- [ ] Typecheck, tests green.

## References

- T-002 (real payment gateway — provider decision: **Paymob**)
- `src/config/env.ts`