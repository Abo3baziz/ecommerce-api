import { logger } from "../../../shared/logger/index.js";
import { REVOKED_SESSION_RETENTION_MS } from "../../../shared/constants/session.js";
import { authRepository } from "../repository/auth.repository.js";

export interface SessionCleanupOptions {
  dryRun?: boolean;
  batchSize?: number;
  revokedRetentionMs?: number;
  now?: Date;
}

export interface SessionCleanupResult {
  dryRun: boolean;
  deletedCount: number;
  ranAt: Date;
}

export async function cleanupExpiredSessions(
  options: SessionCleanupOptions = {},
): Promise<SessionCleanupResult> {
  const now = options.now ?? new Date();
  const dryRun = options.dryRun ?? false;
  const batchSize = options.batchSize ?? 1000;
  const revokedRetentionMs =
    options.revokedRetentionMs ?? REVOKED_SESSION_RETENTION_MS;
  const revokedBefore = new Date(now.getTime() - revokedRetentionMs);

  let deletedCount = 0;

  while (true) {
    const eligible = await authRepository.findCleanupEligibleSessionIds(
      now,
      revokedBefore,
      batchSize,
    );

    if (eligible.length === 0) {
      break;
    }

    if (dryRun) {
      deletedCount += eligible.length;
    } else {
      const result = await authRepository.deleteSessionIds(
        eligible.map((session) => session.id),
      );
      deletedCount += result.count;
    }

    if (eligible.length < batchSize) {
      break;
    }
  }

  logger.info({ dryRun, deletedCount, ranAt: now }, "Session cleanup finished");

  return { dryRun, deletedCount, ranAt: now };
}
