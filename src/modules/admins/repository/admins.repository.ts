import { prisma } from "../../../config/database.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { dbSchema } from "../../../config/database.js";
import { escapeLikePattern } from "../../../shared/utils/index.js";

// Aggregates over sessions and audit_logs cannot be expressed with Prisma's
// typed inputs, so raw SQL with schema-qualified identifiers is used.
const usersTable = Prisma.raw(`"${dbSchema}"."users"`);
const sessionsTable = Prisma.raw(`"${dbSchema}"."sessions"`);
const auditLogsTable = Prisma.raw(`"${dbSchema}"."audit_logs"`);

export interface AdminAccountFilters {
  search?: string;
  status?: "ACTIVE" | "SUSPENDED";
  activity?: "ACTIVE" | "INACTIVE";
}

export interface AdminAccountRow {
  public_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  role: string;
  status: string;
  created_at: Date;
  last_login_at: Date | null;
  last_activity_at: Date | null;
  last_action_at: Date | null;
  last_action_type: string | null;
  activity_status: "ACTIVE" | "INACTIVE";
}

export interface AdminAccountDetailRow extends AdminAccountRow {
  session_count: number;
}

function baseSubquery(inactiveDays: number): Prisma.Sql {
  return Prisma.sql`
    SELECT
      u.id,
      u.public_id,
      u.first_name,
      u.last_name,
      u.email,
      u.phone_number,
      u.role::text AS role,
      u.status::text AS status,
      u.created_at,
      (SELECT MAX(s.created_at) FROM ${sessionsTable} s WHERE s.users_id = u.id) AS last_login_at,
      (SELECT MAX(s.last_activity_at) FROM ${sessionsTable} s WHERE s.users_id = u.id) AS last_activity_at,
      (SELECT a.created_at FROM ${auditLogsTable} a WHERE a.actor_users_id = u.id ORDER BY a.created_at DESC LIMIT 1) AS last_action_at,
      (SELECT a.action FROM ${auditLogsTable} a WHERE a.actor_users_id = u.id ORDER BY a.created_at DESC LIMIT 1) AS last_action_type,
      CASE
        WHEN u.status = 'SUSPENDED' THEN 'SUSPENDED'
        WHEN GREATEST(
          COALESCE((SELECT MAX(s.created_at) FROM ${sessionsTable} s WHERE s.users_id = u.id), '-infinity'::timestamptz),
          COALESCE((SELECT MAX(s.last_activity_at) FROM ${sessionsTable} s WHERE s.users_id = u.id), '-infinity'::timestamptz),
          COALESCE((SELECT MAX(a.created_at) FROM ${auditLogsTable} a WHERE a.actor_users_id = u.id), '-infinity'::timestamptz)
        ) >= now() - (${inactiveDays} * interval '1 day')
        THEN 'ACTIVE'
        ELSE 'INACTIVE'
      END AS activity_status,
      (SELECT COUNT(*)::int FROM ${sessionsTable} s2 WHERE s2.users_id = u.id AND s2.revoked_at IS NULL) AS session_count
    FROM ${usersTable} u
    WHERE u.role IN ('ADMIN', 'SUPER_ADMIN') AND u.deleted_at IS NULL
  `;
}

function buildListWhere(
  filters: AdminAccountFilters,
): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];

  if (filters.search) {
    const pattern = `%${escapeLikePattern(filters.search)}%`;
    conditions.push(
      Prisma.sql`((t.first_name || ' ' || t.last_name) ILIKE ${pattern} ESCAPE '\\' OR t.email ILIKE ${pattern} ESCAPE '\\')`,
    );
  }
  if (filters.status) {
    conditions.push(Prisma.sql`t.status = ${filters.status}`);
  }
  if (filters.activity) {
    conditions.push(Prisma.sql`t.activity_status = ${filters.activity}`);
  }

  if (conditions.length === 0) return Prisma.empty;
  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
}

export const adminsRepository = {
  async listAdmins(
    filters: AdminAccountFilters,
    inactiveDays: number,
    sortField: string,
    descending: boolean,
    skip: number,
    take: number,
  ): Promise<AdminAccountRow[]> {
    const sortColumns: Record<string, string> = {
      name: "(t.first_name || ' ' || t.last_name)",
      created_at: "t.created_at",
      last_login_at: "t.last_login_at",
    };
    const column = sortColumns[sortField] ?? "t.last_login_at";
    const direction = descending ? "DESC NULLS LAST" : "ASC";
    return prisma.$queryRaw<AdminAccountRow[]>`
      WITH base AS (${baseSubquery(inactiveDays)})
      SELECT * FROM base t
      ${buildListWhere(filters)}
      ORDER BY ${Prisma.raw(column)} ${Prisma.raw(direction)}, t.public_id ASC
      LIMIT ${take} OFFSET ${skip}
    `;
  },

  async countAdmins(filters: AdminAccountFilters, inactiveDays: number): Promise<number> {
    const [row] = await prisma.$queryRaw<{ total: number }[]>`
      WITH base AS (${baseSubquery(inactiveDays)})
      SELECT COUNT(*)::int AS total FROM base t
      ${buildListWhere(filters)}
    `;
    return row?.total ?? 0;
  },

  async findAdminByPublicId(public_id: string): Promise<AdminAccountDetailRow | null> {
    const [row] = await prisma.$queryRaw<AdminAccountDetailRow[]>`
      WITH base AS (${baseSubquery(0)})
      SELECT *, (SELECT COUNT(*)::int FROM "${dbSchema}"."sessions" s WHERE s.users_id = base.id AND s.revoked_at IS NULL) AS session_count
      FROM base
      WHERE base.public_id = ${public_id}
    `;
    return row ?? null;
  },

  async suspendAdmin(id: number): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.users.update({
        where: { id },
        data: { status: "SUSPENDED", updated_at: new Date() },
      });
      // Mirrors the customer suspend flow: kill every live session so the
      // account is locked out immediately.
      await tx.sessions.updateMany({
        where: { users_id: id, revoked_at: null },
        data: { revoked_at: new Date() },
      });
    });
  },

  async activateAdmin(id: number): Promise<void> {
    await prisma.users.update({
      where: { id },
      data: { status: "ACTIVE", updated_at: new Date() },
    });
  },

  async findInternalIdByPublicId(public_id: string): Promise<number | null> {
    const row = await prisma.users.findUnique({
      where: { public_id },
      select: { id: true },
    });
    return row?.id ?? null;
  },
};
