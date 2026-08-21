# T-037 — Fix last-admin demotion TOCTOU race

| Field | Value |
|-------|-------|
| **ID** | T-037 |
| **Priority** | P2 |
| **Status** | done |
| **Type** | `bugfix` |
| **Branch** | `bugfix/last-admin-race` |
| **Depends on** | — |
| **Blocks** | T-018 (recovery CLI stays as last resort) |

## Problem

`changeUserRole` runs `countAdmins()` then `updateUserRole` non-transactionally (`src/modules/users/service/admin.service.ts:175-182`). Two concurrent demotions of the last two admins both observe count = 2, both pass the guard, both commit → zero admins remain. Recovery only via bootstrap CLI.

## Goal

The system can never reach zero admins through the API, regardless of concurrency.

## Scope

- Wrap guard + update in one interactive `$transaction`.
- Make the final write conditional so the invariant holds at commit time: e.g. re-count inside the transaction under serializable isolation, or `updateMany({ where: { id, role: currentRole }, data })` combined with an in-tx count check that aborts on violation.
- Cover ADMIN→CUSTOMER demotion of the last admin AND demotion paths that reduce privileged count (SUPER_ADMIN target is already immutable).

## Acceptance criteria

- [x] Concurrent double-demotion test leaves exactly one admin standing; loser gets 409.
- [x] Repeat runs stable (no flake).

## Implementation

- `changeUserRole` runs its guard + write inside one interactive `$transaction` (`src/modules/users/service/admin.service.ts`) opened under a transaction-scoped PostgreSQL advisory lock keyed `hashtext('users:role-change')` (same `pg_advisory_xact_lock` pattern as cart/checkout), serializing every role change.
- Inside the lock the target role is re-read; drift since the caller's read → 409 "User role was changed concurrently". The last-admin count check now runs against the locked, committed state.
- The final write is conditional: `updateUserRole(id, expectedCurrentRole, role)` is an `updateMany({ where: { id, role } })`; 0 affected rows → 409 (defense in depth).
- Repository ops gained optional `DbClient` params: `findUserRoleByPublicId`, `countAdmins`, `updateUserRole`.

## Decisions

- A late request that arrives after the demotion already committed still gets the documented idempotent 200 no-op (fresh read shows target already in the requested role); 409 is reserved for genuine concurrent overlap (stale-state detection) and last-admin violations.
- The advisory lock key is derived from a fixed text label rather than a magic number so it cannot collide with the user-ID-keyed locks used by cart/checkout.
- The guard counts `ADMIN + SUPER_ADMIN` (unchanged policy): demotions that would drop the total privileged count to zero are impossible while the permanent super admin exists; the race fix guarantees correctness for environments without one.

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.2
- Pattern: row-lock + assert pattern from orders (`lockOrderByPublicId`)
