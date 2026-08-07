import { prisma } from "../../../config/database.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import {
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

  updatePassword(id: number, password_hash: string) {
    return prisma.users.update({
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
};
