import { BadRequestError } from "../../../shared/errors/BadRequestError.js";
import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { ForbiddenError } from "../../../shared/errors/ForbiddenError.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import { formatPaginationMeta } from "../../../shared/utils/index.js";
import { logger } from "../../../shared/logger/index.js";
import { prisma } from "../../../config/database.js";
import { user_role, user_status } from "../../../generated/prisma/enums.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import {
  usersRepository,
  type AdminUserRow,
} from "../repository/users.repository.js";
import { parseSort } from "../utils/sort.js";
import type {
  AdminUserResult,
  ChangeUserRoleInput,
  ListAdminUsersResult,
  RoleChangeResult,
  UpdateAdminUserInput,
} from "../dto/adminUser.js";
import type { ListAdminUsersQuery } from "../validators/admin.js";

function toAdminUserResult(row: AdminUserRow): AdminUserResult {
  return {
    public_id: row.public_id,
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    phone_number: row.phone_number,
    role: row.role,
    status: row.status,
    email_verified: row.email_verified_at !== null,
    phone_verified: row.phone_verified_at !== null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toOrderBy(sort: string): Prisma.usersOrderByWithRelationInput {
  const { field, direction } = parseSort(sort);
  const orderField = field === "name" ? "first_name" : field;
  return { [orderField]: direction } as Prisma.usersOrderByWithRelationInput;
}

export async function listAdminUsers(
  query: Pick<
    ListAdminUsersQuery,
    "page" | "limit" | "search" | "status" | "include_deleted" | "sort"
  >,
): Promise<ListAdminUsersResult> {
  const filters = {
    search: query.search,
    status: query.status,
    include_deleted: query.include_deleted,
  };

  const [rows, total] = await Promise.all([
    usersRepository.listAdminUsers(
      filters,
      toOrderBy(query.sort),
      (query.page - 1) * query.limit,
      query.limit,
    ),
    usersRepository.countAdminUsers(filters),
  ]);

  return {
    users: rows.map(toAdminUserResult),
    pagination: formatPaginationMeta(query.page, query.limit, total),
  };
}

export async function getAdminUser(userPublicId: string): Promise<AdminUserResult> {
  const row = await usersRepository.findAdminUserByPublicId(userPublicId);

  if (!row) {
    throw new NotFoundError("User not found");
  }

  return toAdminUserResult(row);
}

export async function updateAdminUser(
  userPublicId: string,
  input: UpdateAdminUserInput,
): Promise<AdminUserResult> {
  const existing = await usersRepository.findAdminUserStatusByPublicId(userPublicId);

  if (!existing) {
    throw new NotFoundError("User not found");
  }

  if (input.email) {
    const emailConflict = await usersRepository.findByEmail(input.email);
    if (emailConflict && emailConflict.id !== existing.id) {
      throw new ConflictError("Email is already in use");
    }
  }

  if (input.phone_number) {
    const phoneConflict = await usersRepository.findByPhoneNumber(input.phone_number);
    if (phoneConflict && phoneConflict.id !== existing.id) {
      throw new ConflictError("Phone number is already in use");
    }
  }

  const updated = await usersRepository.updateAdminUser(existing.id, input);

  return toAdminUserResult(updated);
}

export async function suspendUser(userPublicId: string): Promise<AdminUserResult> {
  const existing = await usersRepository.findAdminUserStatusByPublicId(userPublicId);

  if (!existing) {
    throw new NotFoundError("User not found");
  }

  if (existing.status === user_status.SUSPENDED) {
    throw new BadRequestError("User is already suspended");
  }

  const [updated] = await prisma.$transaction([
    usersRepository.suspendUser(existing.id),
    usersRepository.revokeAllSessions(existing.id),
  ]);

  return toAdminUserResult(updated);
}

export async function activateUser(userPublicId: string): Promise<AdminUserResult> {
  const existing = await usersRepository.findAdminUserStatusByPublicId(userPublicId);

  if (!existing) {
    throw new NotFoundError("User not found");
  }

  if (existing.status === user_status.ACTIVE) {
    throw new BadRequestError("User is already active");
  }

  const updated = await usersRepository.activateUser(existing.id);

  return toAdminUserResult(updated);
}

export async function changeUserRole(
  actor: { id: number; role: user_role },
  targetPublicId: string,
  input: ChangeUserRoleInput,
): Promise<RoleChangeResult> {
  const target = await usersRepository.findUserRoleByPublicId(targetPublicId);

  if (!target) {
    throw new NotFoundError("User not found");
  }

  if (target.id === actor.id) {
    throw new BadRequestError("You cannot change your own role");
  }

  if (actor.role !== user_role.SUPER_ADMIN) {
    throw new ForbiddenError("Insufficient permissions");
  }

  if (target.role === user_role.SUPER_ADMIN) {
    throw new ForbiddenError("The super admin role cannot be changed");
  }

  if (target.role === input.role) {
    return { public_id: target.public_id, role: target.role };
  }

  if (target.role === user_role.ADMIN && input.role === user_role.CUSTOMER) {
    const adminCount = await usersRepository.countAdmins();
    if (adminCount <= 1) {
      throw new ConflictError("Cannot remove the last administrator");
    }
  }

  const updated = await usersRepository.updateUserRole(target.id, input.role);

  logger.info(
    {
      actorId: actor.id,
      targetUserId: target.id,
      previousRole: target.role,
      newRole: updated.role,
    },
    "Admin changed user role",
  );

  return updated;
}
