import type { PaginationMeta } from "../../orders/dto/common.js";
import type { AuditListRow } from "../repository/audit.repository.js";

export interface AuditEntryResult {
  public_id: string;
  action: string;
  entity_type: string | null;
  entity_public_id: string | null;
  method: string | null;
  path: string | null;
  status_code: number;
  request_body: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  actor: {
    public_id: string | null;
    name: string | null;
    email: string | null;
  };
}

export interface ListAuditResult {
  entries: AuditEntryResult[];
  pagination: PaginationMeta;
}

export type { AuditListRow };

export interface AuditRecordInput {
  actorUsersId?: number | null;
  action: string;
  entityType?: string | null;
  entityPublicId?: string | null;
  method?: string | null;
  path?: string | null;
  statusCode: number;
  requestBody?: unknown;
  previousValues?: unknown;
  changes?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}
