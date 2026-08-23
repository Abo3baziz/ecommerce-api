import { prisma } from "../../../config/database.js";
import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import { formatPaginationMeta } from "../../../shared/utils/index.js";
import {
  adminsRepository,
  type AdminAccountDetailRow,
  type AdminAccountRow,
} from "../repository/admins.repository.js";

export interface AdminAccountResult {
  public_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  role: string;
  status: "ACTIVE" | "SUSPENDED";
  activity_status: "ACTIVE" | "INACTIVE";
  created_at: Date;
  last_login_at: Date | null;
  last_activity_at: Date | null;
  last_action_at: Date | null;
  last_action_type: string | null;
}

function toAccountResult(
  row: AdminAccountRow & { session_count?: number },
): AdminAccountResult & { session_count?: number } {
  return {
    public_id: row.public_id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone_number: row.phone_number,
    role: row.role,
    status: row.status as "ACTIVE" | "SUSPENDED",
    activity_status: row.activity_status,
    created_at: row.created_at,
    last_login_at: row.last_login_at,
    last_activity_at: row.last_activity_at,
    last_action_at: row.last_action_at,
    last_action_type: row.last_action_type ?? null,
    ...(row.session_count !== undefined ? { session_count: row.session_count } : {}),
  };
}

export interface AdminActor {
  id: number;
}

export async function listAdminAccounts(
  page: number,
  limit: number,
  filters: { search?: string; status?: "ACTIVE" | "SUSPENDED"; activity?: "ACTIVE" | "INACTIVE" },
  inactiveDays: number,
  sortField: string,
  descending: boolean,
): Promise<{ accounts: AdminAccountResult[]; pagination: ReturnType<typeof formatPaginationMeta> }> {
  const [rows, total] = await Promise.all([
    adminsRepository.listAdmins(filters, inactiveDays, sortField, descending, (page - 1) * limit, limit),
    adminsRepository.countAdmins(filters, inactiveDays),
  ]);
  return {
    accounts: rows.map(toAccountResult),
    pagination: formatPaginationMeta(page, limit, total),
  };
}

export async function getAdminAccount(publicId: string, inactiveDays: number): Promise<AdminAccountResult & { session_count?: number }> {
  const row = await adminsRepository.findAdminByPublicId(publicId);
  if (!row) throw new NotFoundError("Admin account not found");
  return toAccountResult(row);
}

async function requireSuspendableAdmin(
  adminPublicId: string,
  actor: AdminActor,
): Promise<number> {
  const id = await adminsRepository.findInternalIdByPublicId(adminPublicId);
  if (!id) throw new NotFoundError("Admin account not found");
  if (id === actor.id) {
    throw new ConflictError("You cannot change your own account status here");
  }
  // The single SUPER_ADMIN account is permanent and cannot be disabled.
  const target = await prisma.users.findUnique({ where: { id }, select: { role: true, status: true } });
  if (!target) throw new NotFoundError("Admin account not found");
  if (target.role === "SUPER_ADMIN") {
    throw new ConflictError("The super admin account cannot be deactivated");
  }
  return id;
}

export async function suspendAdminAccount(
  adminPublicId: string,
  actor: AdminActor,
): Promise<void> {
  const id = await requireSuspendableAdmin(adminPublicId, actor);
  const current = await prisma.users.findUnique({ where: { id }, select: { status: true } });
  if (current?.status === "SUSPENDED") {
    throw new ConflictError("This admin is already suspended");
  }
  await adminsRepository.suspendAdmin(id);
}

export async function activateAdminAccount(
  adminPublicId: string,
  actor: AdminActor,
): Promise<void> {
  const id = await requireSuspendableAdmin(adminPublicId, actor);
  const current = await prisma.users.findUnique({ where: { id }, select: { status: true } });
  if (current?.status !== "SUSPENDED") {
    throw new ConflictError("This admin is not suspended");
  }
  await adminsRepository.activateAdmin(id);
}
