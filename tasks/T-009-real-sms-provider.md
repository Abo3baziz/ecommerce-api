# T-009 — Real SMS provider for phone OTP

| Field | Value |
|-------|-------|
| **ID** | T-009 |
| **Priority** | P1 |
| **Status** | wontfix |
| **Type** | `feature` |
| **Branch** | `feature/sms-provider` |
| **Depends on** | — |
| **Blocks** | Production phone change / phone verification |

## Scope decision

Removed from scope (2026-08-18, per user decision). Phone-number change verification continues to rely on the `sendSms` stub (`src/shared/sms/index.ts`), which logs the OTP. If real SMS delivery is needed later, revisit this task and integrate a provider behind the existing `sendSms` abstraction.

## Problem

`src/shared/sms/index.ts` is a **stub** that only logs the OTP. Phone-number change verification cannot work for real users.

## Goal

Integrate a real SMS provider behind the existing `sendSms` abstraction.

## Scope

- Choose provider (Twilio, MessageBird, Vonage, etc. — decision).
- Implement adapter; keep stub for `NODE_ENV=test`.
- Env vars + secrets; rate limits already exist on phone-change routes.
- Never log full OTP in production logs (mask or omit).
- Docs: `docs/OPERATIONS.md`, users change-phone doc.
- Integration tests with mocked provider client.

## Acceptance criteria

- [ ] Staging can receive a real OTP SMS.
- [ ] Tests still use stub/mock (no real SMS in CI).
- [ ] OTP not written in full to production logs.
- [ ] Docs updated; suite green.

## References

- `PROJECT_PROGRESS.md` — Pending
- `src/shared/sms/index.ts`
- `docs/api/users/change-phone.md`
