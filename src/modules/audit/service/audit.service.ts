import { Prisma } from "../../../generated/prisma/client.js";
import { PUBLIC_ID_PREFIXES } from "../../../shared/constants/index.js";
import { logger } from "../../../shared/logger/index.js";
import {
  formatPaginationMeta,
  generatePublicId,
} from "../../../shared/utils/index.js";
import {
  auditRepository,
  type AuditListFilters,
} from "../repository/audit.repository.js";
import type {
  AuditEntryResult,
  AuditRecordInput,
  ListAuditResult,
} from "../dto/audit.js";

/**
 * Append one audit row. NEVER throws: auditing must not break the business
 * request it observes. Failures are logged for ops visibility.
 */
export async function recordAuditEvent(input: AuditRecordInput): Promise<void> {
  try {
    await auditRepository.createAuditLog({
      public_id: generatePublicId(PUBLIC_ID_PREFIXES.AUDIT),
      actor_users_id: input.actorUsersId ?? null,
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_public_id: input.entityPublicId ?? null,
      method: input.method ?? null,
      path: input.path ?? null,
      status_code: input.statusCode,
      request_body: input.requestBody,
      previous_values: input.previousValues,
      changes: input.changes,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    });
  } catch (error) {
    logger.error({ err: error, action: input.action }, "Failed to write audit log");
  }
}

/**
 * Transactional variant: writes the audit row through the caller's
 * transaction client and THROWS on failure, so a business action that must
 * not happen without an audit record rolls back together with it.
 */
export async function recordAuditEventInTx(
  tx: Prisma.TransactionClient,
  input: AuditRecordInput & { previousValues?: unknown; changes?: unknown },
): Promise<void> {
  await auditRepository.createAuditLog(
    {
      public_id: generatePublicId(PUBLIC_ID_PREFIXES.AUDIT),
      actor_users_id: input.actorUsersId ?? null,
      action: input.action,
      entity_type: input.entityType ?? null,
      entity_public_id: input.entityPublicId ?? null,
      method: input.method ?? null,
      path: input.path ?? null,
      status_code: input.statusCode,
      request_body: input.requestBody,
      previous_values: input.previousValues,
      changes: input.changes,
      ip_address: input.ipAddress ?? null,
      user_agent: input.userAgent ?? null,
    },
    tx,
  );
}

export function toAuditEntryResult(row: Awaited<ReturnType<typeof auditRepository.listAuditLogs>>[number]): AuditEntryResult {
  return {
    public_id: row.public_id,
    action: row.action,
    entity_type: row.entity_type,
    entity_public_id: row.entity_public_id,
    method: row.method,
    path: row.path,
    status_code: row.status_code,
    request_body: row.request_body ?? null,
    ip_address: row.ip_address,
    user_agent: row.user_agent,
    created_at: row.created_at,
    actor: {
      public_id: row.actor_public_id,
      name: row.actor_name,
      email: row.actor_email,
    },
  };
}

export async function listAudit(
  page: number,
  limit: number,
  filters: AuditListFilters,
): Promise<ListAuditResult> {
  const [rows, total] = await Promise.all([
    auditRepository.listAuditLogs(filters, (page - 1) * limit, limit),
    auditRepository.countAuditLogs(filters),
  ]);

  return {
    entries: rows.map(toAuditEntryResult),
    pagination: formatPaginationMeta(page, limit, total),
  };
}
