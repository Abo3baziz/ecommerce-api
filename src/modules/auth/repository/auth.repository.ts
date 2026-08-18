import { prisma } from "../../../config/database.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import {
  user_role,
  user_status,
  verification_type,
} from "../../../generated/prisma/enums.js";

type DbClient = Prisma.TransactionClient | typeof prisma;

export interface CreateUserData {
  public_id: string;
  email: string;
  phone_number: string;
  first_name: string;
  last_name: string;
  password_hash: string;
  role: user_role;
  status: user_status;
}

export interface CreateVerificationTokenData {
  public_id: string;
  token_hash: string;
  target: string;
  purpose: verification_type;
  expires_at: Date;
  users_id: number;
}

export interface CreateSessionData {
  public_id: string;
  refresh_token_hash: string;
  expires_at: Date;
  is_current: boolean;
  users_id: number;
  ip_address?: string | null;
  user_agent?: string | null;
  device_name?: string | null;
}

export const authRepository = {
  findByEmail(email: string) {
    return prisma.users.findUnique({
      where: { email },
      select: { id: true },
    });
  },

  findUserByEmailWithCredentials(email: string) {
    return prisma.users.findUnique({
      where: { email },
    });
  },

  findByPhoneNumber(phone_number: string) {
    return prisma.users.findUnique({
      where: { phone_number },
      select: { id: true },
    });
  },

  createUser(data: CreateUserData) {
    const now = new Date();
    return prisma.users.create({
      data: {
        ...data,
        created_at: now,
        updated_at: now,
      },
    });
  },

  createVerificationToken(data: CreateVerificationTokenData) {
    return prisma.verification_tokens.create({
      data: {
        ...data,
        created_at: new Date(),
      },
    });
  },

  findVerificationTokenByHash(token_hash: string, purpose: verification_type) {
    return prisma.verification_tokens.findFirst({
      where: { token_hash, purpose },
    });
  },

  markEmailVerified(users_id: number, client: DbClient = prisma) {
    return client.users.update({
      where: { id: users_id },
      data: {
        email_verified_at: new Date(),
        updated_at: new Date(),
      },
    });
  },

  invalidateVerificationToken(id: number, client: DbClient = prisma) {
    const now = new Date();
    return client.verification_tokens.update({
      where: { id },
      data: {
        used_at: now,
        verified_at: now,
      },
    });
  },

  invalidateUnusedVerificationTokens(users_id: number, purpose: verification_type) {
    return prisma.verification_tokens.updateMany({
      where: {
        users_id,
        purpose,
        used_at: null,
      },
      data: { used_at: new Date() },
    });
  },

  createSession(data: CreateSessionData) {
    const now = new Date();
    return prisma.sessions.create({
      data: {
        ...data,
        created_at: now,
        last_activity_at: now,
      },
    });
  },

  findSessionByTokenHash(refresh_token_hash: string) {
    return prisma.sessions.findFirst({
      where: { refresh_token_hash },
      include: { users: true },
    });
  },

  touchSession(id: number) {
    return prisma.sessions.update({
      where: { id },
      data: { last_activity_at: new Date() },
    });
  },

  revokeSession(id: number) {
    return prisma.sessions.update({
      where: { id },
      data: { revoked_at: new Date() },
    });
  },

  findActiveSessionsByUser(users_id: number) {
    return prisma.sessions.findMany({
      where: {
        users_id,
        revoked_at: null,
        expires_at: { gt: new Date() },
      },
      orderBy: { created_at: "desc" },
      select: {
        public_id: true,
        device_name: true,
        user_agent: true,
        ip_address: true,
        last_activity_at: true,
        created_at: true,
      },
    });
  },

  findActiveSessionByPublicIdAndUser(public_id: string, users_id: number) {
    return prisma.sessions.findFirst({
      where: {
        public_id,
        users_id,
        revoked_at: null,
        expires_at: { gt: new Date() },
      },
    });
  },

  revokeAllSessionsExcept(users_id: number, exceptId: number) {
    return prisma.sessions.updateMany({
      where: {
        users_id,
        id: { not: exceptId },
        revoked_at: null,
      },
      data: { revoked_at: new Date() },
    });
  },

  findCleanupEligibleSessionIds(now: Date, revokedBefore: Date, take: number) {
    return prisma.sessions.findMany({
      where: {
        OR: [
          { expires_at: { lt: now } },
          { revoked_at: { lt: revokedBefore } },
        ],
      },
      select: { id: true },
      orderBy: { id: "asc" },
      take,
    });
  },

  deleteSessionIds(ids: number[]) {
    return prisma.sessions.deleteMany({
      where: { id: { in: ids } },
    });
  },
};
