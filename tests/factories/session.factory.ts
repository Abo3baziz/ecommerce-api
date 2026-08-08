import { prisma } from "../../src/config/database.js";
import { generatePublicId } from "../../src/shared/utils/index.js";
import { PUBLIC_ID_PREFIXES } from "../../src/shared/constants/index.js";
import { SESSION_TTL_MS } from "../../src/shared/constants/session.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../src/modules/auth/utils/tokens.js";

export interface CreateSessionOverrides {
  expires_at?: Date;
  revoked_at?: Date | null;
  is_current?: boolean;
  ip_address?: string | null;
  user_agent?: string | null;
  device_name?: string | null;
}

export async function createSessionForUser(
  usersId: number,
  overrides: CreateSessionOverrides = {},
) {
  const token = generateOpaqueToken();
  const now = new Date();

  const session = await prisma.sessions.create({
    data: {
      public_id: generatePublicId(PUBLIC_ID_PREFIXES.SESSION),
      refresh_token_hash: hashToken(token),
      expires_at: overrides.expires_at ?? new Date(Date.now() + SESSION_TTL_MS),
      revoked_at: overrides.revoked_at ?? null,
      is_current: overrides.is_current ?? true,
      users_id: usersId,
      ip_address: overrides.ip_address ?? null,
      user_agent: overrides.user_agent ?? null,
      device_name: overrides.device_name ?? null,
      created_at: now,
      last_activity_at: now,
    },
  });

  return { token, session };
}
