import { prisma } from "../../../config/database.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import {
  user_role,
  user_status,
  verification_type,
} from "../../../generated/prisma/enums.js";

type DbClient = Prisma.TransactionClient | typeof prisma;

const userSelect = {
  id: true,
  public_id: true,
  first_name: true,
  last_name: true,
  email: true,
  phone_number: true,
  email_verified_at: true,
  created_at: true,
  updated_at: true,
} as const;

export type UserRow = Prisma.usersGetPayload<{
  select: typeof userSelect;
}>;

const adminUserSelect = {
  id: true,
  public_id: true,
  first_name: true,
  last_name: true,
  email: true,
  phone_number: true,
  role: true,
  status: true,
  email_verified_at: true,
  phone_verified_at: true,
  created_at: true,
  updated_at: true,
} as const;

export type AdminUserRow = Prisma.usersGetPayload<{
  select: typeof adminUserSelect;
}>;

export interface AdminUserFilters {
  search?: string;
  status?: user_status;
  include_deleted?: boolean;
}

function buildAdminUserWhere(filters: AdminUserFilters): Prisma.usersWhereInput {
  const where: Prisma.usersWhereInput = {
    role: user_role.CUSTOMER,
  };

  if (!filters.include_deleted) {
    where.deleted_at = null;
  }

  if (filters.status !== undefined) {
    where.status = filters.status;
  }

  if (filters.search) {
    where.OR = [
      { first_name: { contains: filters.search, mode: "insensitive" } },
      { last_name: { contains: filters.search, mode: "insensitive" } },
      { email: { contains: filters.search, mode: "insensitive" } },
      { phone_number: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  return where;
}

export const usersRepository = {
  findById(id: number) {
    return prisma.users.findUnique({
      where: { id },
      select: userSelect,
    });
  },

  findByEmail(email: string) {
    return prisma.users.findUnique({
      where: { email },
      select: { id: true },
    });
  },

  findByPhoneNumber(phone_number: string) {
    return prisma.users.findUnique({
      where: { phone_number },
      select: { id: true },
    });
  },

  updateProfile(id: number, data: { first_name?: string; last_name?: string }) {
    return prisma.users.update({
      where: { id },
      data: {
        ...data,
        updated_at: new Date(),
      },
      select: userSelect,
    });
  },

  updatePassword(id: number, password_hash: string, client: DbClient = prisma) {
    return client.users.update({
      where: { id },
      data: {
        password_hash,
        updated_at: new Date(),
      },
      select: { id: true },
    });
  },

  updateEmail(id: number, email: string, client: DbClient = prisma) {
    return client.users.update({
      where: { id },
      data: {
        email,
        email_verified_at: new Date(),
        updated_at: new Date(),
      },
      select: userSelect,
    });
  },

  updatePhone(id: number, phone_number: string, client: DbClient = prisma) {
    return client.users.update({
      where: { id },
      data: {
        phone_number,
        phone_verified_at: new Date(),
        updated_at: new Date(),
      },
      select: userSelect,
    });
  },

  softDeleteAccount(id: number, client: DbClient = prisma) {
    return client.users.update({
      where: { id },
      data: {
        status: user_status.DELETED,
        deleted_at: new Date(),
        updated_at: new Date(),
      },
      select: { id: true },
    });
  },

  revokeAllSessions(users_id: number, client: DbClient = prisma) {
    return client.sessions.updateMany({
      where: {
        users_id,
        revoked_at: null,
      },
      data: { revoked_at: new Date() },
    });
  },

  revokeAllOtherSessions(users_id: number, exceptId: number) {
    return prisma.sessions.updateMany({
      where: {
        users_id,
        id: { not: exceptId },
        revoked_at: null,
      },
      data: { revoked_at: new Date() },
    });
  },

  hasPendingVerificationToken(users_id: number, purpose: verification_type) {
    return prisma.verification_tokens.findFirst({
      where: {
        users_id,
        purpose,
        used_at: null,
        expires_at: { gt: new Date() },
      },
      select: { id: true },
    });
  },

  listAdminUsers(
    filters: AdminUserFilters,
    orderBy: Prisma.usersOrderByWithRelationInput,
    skip: number,
    take: number,
  ) {
    return prisma.users.findMany({
      where: buildAdminUserWhere(filters),
      orderBy,
      skip,
      take,
      select: adminUserSelect,
    });
  },

  countAdminUsers(filters: AdminUserFilters) {
    return prisma.users.count({
      where: buildAdminUserWhere(filters),
    });
  },

  findAdminUserByPublicId(public_id: string) {
    return prisma.users.findFirst({
      where: {
        public_id,
        role: user_role.CUSTOMER,
        deleted_at: null,
      },
      select: adminUserSelect,
    });
  },

  findAdminUserStatusByPublicId(public_id: string) {
    return prisma.users.findFirst({
      where: {
        public_id,
        role: user_role.CUSTOMER,
        deleted_at: null,
      },
      select: { id: true, status: true },
    });
  },

  findUserRoleByPublicId(public_id: string) {
    return prisma.users.findFirst({
      where: {
        public_id,
        deleted_at: null,
      },
      select: { id: true, public_id: true, role: true },
    });
  },

  updateAdminUser(id: number, data: { first_name?: string; last_name?: string; email?: string; phone_number?: string }) {
    return prisma.users.update({
      where: { id },
      data: {
        ...data,
        updated_at: new Date(),
      },
      select: adminUserSelect,
    });
  },

  suspendUser(id: number, client: DbClient = prisma) {
    return client.users.update({
      where: { id },
      data: {
        status: user_status.SUSPENDED,
        updated_at: new Date(),
      },
      select: adminUserSelect,
    });
  },

  activateUser(id: number, client: DbClient = prisma) {
    return client.users.update({
      where: { id },
      data: {
        status: user_status.ACTIVE,
        updated_at: new Date(),
      },
      select: adminUserSelect,
    });
  },

  updateUserRole(id: number, role: user_role, client: DbClient = prisma) {
    return client.users.update({
      where: { id },
      data: {
        role,
        updated_at: new Date(),
      },
      select: { public_id: true, role: true },
    });
  },

  countAdmins() {
    return prisma.users.count({
      where: {
        role: { in: [user_role.ADMIN, user_role.SUPER_ADMIN] },
        deleted_at: null,
      },
    });
  },

  countSuperAdmins() {
    return prisma.users.count({
      where: {
        role: user_role.SUPER_ADMIN,
        deleted_at: null,
      },
    });
  },
};
