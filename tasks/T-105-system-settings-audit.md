# T-105 — System settings audit trail (append-only, redacted)

| Field | Value |
|-------|-------|
| **ID** | T-105 |
| **Priority** | P0 |
| **Status** | done |
| **Type** | `security` |
| **Branch** | `feature/system-settings` |
| **Depends on** | T-101, T-102, T-103, T-104 |
| **Blocks** | T-106 |

## Problem

Requirement §12: every important setting change must be in existing append-only `audit_logs`, with who/what/prev/next/timestamp, never leaking secrets.

## Goal

Transactional per-field diff audit for all `PATCH /admin/settings/:section`, redacted, ATOMically with settings update.

## Scope

- Extend `SENSITIVE_KEY_PATTERN` in `src/middleware/auditLog.ts:22` to `/password|secret|token|otp|key|private|webhook/i` if not already.
- Exclude `/admin/settings` from auto `auditAdminMutations` OR keep auto but also emit transactional row — choose **transactional** and add `/admin/settings` to `AUDIT_EXCLUDED_PREFIXES` to avoid duplicate/partial rows without diff.
- Service `src/modules/settings/service/settings.service.ts` — inside `prisma.$transaction` after `upsert`: `changes=buildChanges(prev.value, input)` (reuse `src/modules/coupons/service/coupons.service.ts:233` pattern), `redactedPrev=redact(prev.value)`, `redactedChanges=redact(changes)`, `await recordAuditEventInTx(tx, {action:`admin.settings.${section}_update`, entityType:"system_settings", entityPublicId:section, actorUsersId:actor.id, method:"PATCH", path:req.originalUrl.slice(0,255), statusCode:200, requestBody:redact(input), previousValues:redactedPrev, changes:redactedChanges, ipAddress, userAgent})`.
- `GET /admin/audit?entity_type=system_settings&entity_public_id=general` must surface rows via existing `src/modules/audit/repository/audit.repository.ts:1` without code change.

## Acceptance criteria

- [ ] `PATCH /admin/settings/general` creates one `audit_logs` row with `action=admin.settings.general_update`, `entity_type=system_settings`, correct `actor_users_id`, `previous_values` and `changes` JSON, no raw secret strings.
- [ ] `GET /admin/audit?entity_type=system_settings` returns rows paginated.
- [ ] Secrets never appear in `audit_logs.request_body`, `previous_values`, `changes`, or `logs/app.ndjson`.
- [ ] `npm run typecheck` green.

## References

- `src/middleware/auditLog.ts:1`, `src/modules/audit/service/audit.service.ts:1`, `src/modules/audit/repository/audit.repository.ts:1`, `src/modules/coupons/service/coupons.service.ts:233`, `src/shared/logger/redact.ts:1`
