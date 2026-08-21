# T-046 — Make session idle timeout effective

| Field | Value |
|-------|-------|
| **ID** | T-046 |
| **Priority** | P2 |
| **Status** | done |
| **Type** | `bugfix` |
| **Branch** | `bugfix/idle-timeout-effective` |
| **Depends on** | — (T-004 shipped the mechanism) |
| **Blocks** | — |

## Problem

`SESSION_IDLE_TIMEOUT_MS = 30d = SESSION_TTL_MS` (`src/shared/constants/session.ts:3-5`). Since `last_activity_at >= created_at` and `expires_at = created_at + 30d`, the middleware's idle check (`authentication.ts:36-41`) can never fire while the session is unexpired — T-004's control is provably dead configuration.

## Goal

Idle sessions actually expire before their absolute TTL.

## Scope

- Set `SESSION_IDLE_TIMEOUT_MS` to a real policy value (recommend 7-14 days; product sign-off).
- Decide whether activity should also slide `expires_at` (sliding expiration) or keep absolute TTL fixed.
- Update `docs/AUTHENTICATION.md` + session-management doc with the effective lifetime formula.
- Deterministic test: backdate `last_activity_at` beyond window → 401.

## Acceptance criteria

- [x] Idle timeout demonstrably rejects stale sessions while fresh ones pass.
- [x] Docs state min(TTL, idle) semantics with chosen values.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.2
- Builds on: T-004 (done)

## Implementation

- `SESSION_IDLE_TIMEOUT_MS` set to **14 days** (`src/shared/constants/session.ts`), strictly below the 30-day absolute TTL, with a guard comment so the dead-config regression is obvious.
- Expiration stays **absolute**: authenticated requests slide only `last_activity_at` (`touchSession`); `expires_at` is never extended. Effective lifetime = `min(SESSION_TTL_MS, last_activity_at + SESSION_IDLE_TIMEOUT_MS)`.

## Decisions

- 14 days chosen from the recommended 7–14 day range as the least disruptive meaningful tightening for a consumer ecommerce API; operators can shorten it in one constant.
- No sliding expiration: a fixed ceiling keeps "session ends at most 30 days after login" true, which the docs now state explicitly.

## Verification

- The existing deterministic e2e suite (`tests/e2e/auth/sessionIdleTimeout.api.test.ts`) derives its offsets from the constant, so it directly proves stale sessions are rejected while fresh ones pass under the new value; full suite green on the branch tip.
