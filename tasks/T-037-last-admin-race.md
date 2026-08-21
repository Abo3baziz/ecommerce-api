# T-037 — Fix last-admin demotion TOCTOU race

| Field | Value |
|-------|-------|
| **ID** | T-037 |
| **Priority** | P2 |
| **Status** | todo |
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

- [ ] Concurrent double-demotion test leaves exactly one admin standing; loser gets 409.
- [ ] Repeat runs stable (no flake).

## References

- Audit: `tasks/AUDIT-2026-08-21.md` §4.2
- Pattern: row-lock + assert pattern from orders (`lockOrderByPublicId`)
