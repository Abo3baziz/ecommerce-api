import { prisma } from "../../../config/database.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { dbSchema } from "../../../config/database.js";

const auditTable = Prisma.raw(`"${dbSchema}"."audit_logs"`);
const usersTable = Prisma.raw(`"${dbSchema}"."users"`);

export interface AuditLogCreateData {
  public_id: string;
  actor_users_id?: number | null;
  action: string;
  entity_type?: string | null;
  entity_public_id?: string | null;
  method?: string | null;
  path?: string | null;
  status_code: number;
  request_body?: unknown;
  ip_address?: string | null;
  user_agent?: string | null;
}

export interface AuditListFilters {
  actorPublicId?: string;
  actionPrefix?: string;
  entityType?: string;
  entityPublicId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface AuditListRow {
  id: number;
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
  actor_public_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
}

function buildListWhere(filters: AuditListFilters): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];

  if (filters.actorPublicId) {
    conditions.push(Prisma.sql`u.public_id = ${filters.actorPublicId}`);
  }
  if (filters.actionPrefix) {
    conditions.push(Prisma.sql`a.action ILIKE ${`${filters.actionPrefix}%`}`);
  }
  if (filters.entityType) {
    conditions.push(Prisma.sql`a.entity_type = ${filters.entityType}`);
  }
  if (filters.entityPublicId) {
    conditions.push(
      Prisma.sql`a.entity_public_id = ${filters.entityPublicId}`,
    );
  }
  if (filters.dateFrom) {
    conditions.push(Prisma.sql`a.created_at >= ${filters.dateFrom}`);
  }
  if (filters.dateTo) {
    conditions.push(Prisma.sql`a.created_at <= ${filters.dateTo}`);
  }

  if (conditions.length === 0) {
    return Prisma.empty;
  }
  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
}

export const auditRepository = {
  createAuditLog(data: AuditLogCreateData): Promise<unknown> {
    return prisma.audit_logs.create({
      data: {
        public_id: data.public_id,
        actor_users_id: data.actor_users_id ?? null,
        action: data.action,
        entity_type: data.entity_type ?? null,
        entity_public_id: data.entity_public_id ?? null,
        method: data.method ?? null,
        path: data.path ?? null,
        status_code: data.status_code,
        request_body:
          data.request_body === undefined
            ? Prisma.JsonNull
            : (data.request_body as Prisma.InputJsonValue),
        ip_address: data.ip_address ?? null,
        user_agent: data.user_agent ?? null,
        created_at: new Date(),
      },
      select: { id: true },
    });
  },

  async listAuditLogs(
    filters: AuditListFilters,
    skip: number,
    take: number,
  ): Promise<AuditListRow[]> {
    return prisma.$queryRaw<AuditListRow[]>`
      SELECT
        a.id,
        a.public_id,
        a.action,
        a.entity_type,
        a.entity_public_id,
        a.method,
        a.path,
        a.status_code,
        a.request_body,
        a.ip_address,
        a.user_agent,
        a.created_at,
        u.public_id AS actor_public_id,
        (u.first_name || ' ' || u.last_name) AS actor_name,
        u.email AS actor_email
      FROM ${auditTable} a
      LEFT JOIN ${usersTable} u ON u.id = a.actor_users_id
      ${buildListWhere(filters)}
      ORDER BY a.created_at DESC, a.id DESC
      LIMIT ${take} OFFSET ${skip}
    `;
  },

  async countAuditLogs(filters: AuditListFilters): Promise<number> {
    const rows = await prisma.$queryRaw<{ total: number }[]>`
      SELECT count(*)::int AS total
      FROM ${auditTable} a
      LEFT JOIN ${usersTable} u ON u.id = a.actor_users_id
      ${buildListWhere(filters)}
    `;
    return rows[0]?.total ?? 0;
  },
};
