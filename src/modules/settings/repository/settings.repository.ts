import { prisma } from "../../../config/database.js";
import type { Prisma } from "../../../generated/prisma/client.js";

export type SystemSettingsRow = Prisma.system_settingsGetPayload<{ include: { users: { select: { public_id: true } } } }>;

// The users include only carries the actor's public_id so internal IDs never
// reach the service layer / API responses.
const ACTOR_INCLUDE = { users: { select: { public_id: true } } } as const;

export const settingsRepository = {
  findByKey(key: string, client: Prisma.TransactionClient | typeof prisma = prisma) {
    return (client as typeof prisma).system_settings.findUnique({ where: { key }, include: ACTOR_INCLUDE });
  },

  findMany(keys?: string[], client: Prisma.TransactionClient | typeof prisma = prisma) {
    if (keys && keys.length > 0) {
      return (client as typeof prisma).system_settings.findMany({ where: { key: { in: keys } }, include: ACTOR_INCLUDE });
    }
    return (client as typeof prisma).system_settings.findMany({ include: ACTOR_INCLUDE });
  },

  upsert(
    key: string,
    data: { value: Prisma.InputJsonValue; updated_by: number | null },
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    const now = new Date();
    return (client as typeof prisma).system_settings.upsert({
      where: { key },
      create: { key, value: data.value as Prisma.InputJsonValue, updated_at: now, updated_by: data.updated_by },
      update: { value: data.value as Prisma.InputJsonValue, updated_at: now, updated_by: data.updated_by },
      include: ACTOR_INCLUDE,
    });
  },
};
