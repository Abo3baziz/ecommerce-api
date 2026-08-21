# T-015 — Dedicated admin audit-log table

| Field | Value |
|-------|-------|
| **ID** | T-015 |
| **Priority** | P2 |
| **Status** | todo |
| **Type** | `feature` |
| **Branch** | `feature/admin-audit-log` |
| **Depends on** | — |
| **Blocks** | — |

## Problem

Administrator actions (role changes, order status, inventory adjustments) are only written to the structured logger. There is no queryable audit table for compliance or admin UI history.

## Goal

Introduce a durable `audit_logs` (name TBD) table and write critical admin actions to it transactionally where appropriate.

## Scope

- Schema + migration (public_id, actor_users_id, action, entity_type, entity_public_id, metadata JSON, created_at).
- Service helper `recordAuditEvent(...)`.
- Wire: role change, order status change, inventory patch, user activate/deactivate (as applicable).
- Optional admin list endpoint (or defer UI).
- Docs: DATABASE.md, admin.md, OPERATIONS.md.

## Acceptance criteria

- [ ] Critical admin actions persist audit rows.
- [ ] Logger may still emit events.
- [ ] Migration + tests for at least one action path.

## References

- `PROJECT_PROGRESS.md` — Pending
- `docs/api/admin/admin.md` (future audit note)
