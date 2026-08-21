# T-038 — Phone OTP attempt limiting and failure counter

| Field | Value |
|-------|-------|
| **ID** | T-038 |
| **Priority** | P2 |
| **Status** | wontfix |
| **Type** | `feature` |
| **Branch** | `feature/otp-attempt-limit` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

`POST /users/me/phone-number/verify` (`src/modules/users/routes/users.routes.ts:61-65`) has no dedicated limiter and `verifyPhoneChange` (`src/modules/users/service/users.service.ts:252-301`) performs unlimited guesses per token within its 10-minute TTL. Attack: trigger a change to the victim's number (SMS goes to victim), then brute-force the 6-digit code; success binds the victim's phone to the attacker's account, intercepting future SMS.

## Goal

OTP guessing is computationally infeasible within the TTL.

## Scope

- Track failed attempts per verification-token row (schema addition or reuse of an existing counter column) and invalidate the token after N failures (3-5).
- Add a dedicated route limiter (e.g. 5/min) on the verify endpoint.
- Return consistent error copy that does not reveal remaining attempts beyond policy.

## Acceptance criteria

- [ ] Exceeding failure count invalidates the pending OTP (410 on further tries).
- [ ] Route limiter returns 429.
- [ ] Integration tests cover lockout + fresh-OTP recovery path.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.2

## Resolution

**Wontfix (2026-08-21, user decision):** phone-number change via SMS OTP will not be used — a real SMS provider is too expensive for this project. This follows the earlier `wontfix` on T-009 (real SMS provider): the phone flow remains wired to the dev SMS stub that logs codes, so hardening OTP guessing has no production value here. If a paid SMS provider is ever adopted, revisit this task together with T-009.
