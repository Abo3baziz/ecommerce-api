import { describe, it, expect, beforeEach } from "vitest";
import { cleanupExpiredSessions } from "../../../src/modules/auth/service/sessionCleanup.service.js";
import { REVOKED_SESSION_RETENTION_MS } from "../../../src/shared/constants/session.js";
import { prisma } from "../../../src/config/database.js";
import { createUser } from "../../factories/user.factory.js";
import { createSessionForUser } from "../../factories/session.factory.js";
import { cleanupTestData } from "../../helpers/db.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function countSessionsForUser(usersId: number) {
  return prisma.sessions.count({ where: { users_id: usersId } });
}

describe("cleanupExpiredSessions", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  it("deletes only expired and long-revoked sessions", async () => {
    const user = await createUser();

    await createSessionForUser(user.id, {
      expires_at: new Date(Date.now() + DAY_MS),
    });
    await createSessionForUser(user.id, {
      expires_at: new Date(Date.now() - DAY_MS),
    });
    await createSessionForUser(user.id, {
      revoked_at: new Date(
        Date.now() - REVOKED_SESSION_RETENTION_MS - DAY_MS,
      ),
    });
    await createSessionForUser(user.id, {
      revoked_at: new Date(Date.now() - DAY_MS),
    });

    expect(await countSessionsForUser(user.id)).toBe(4);

    const result = await cleanupExpiredSessions();

    expect(result.deletedCount).toBe(2);

    const remaining = await prisma.sessions.findMany({
      where: { users_id: user.id },
      select: { expires_at: true, revoked_at: true },
    });
    expect(remaining).toHaveLength(2);
    remaining.forEach((row) => {
      expect(row.expires_at.getTime()).toBeGreaterThan(Date.now());
    });
    expect(remaining.filter((row) => row.revoked_at === null)).toHaveLength(1);
    expect(
      remaining.filter((row) => row.revoked_at !== null),
    ).toHaveLength(1);
  });

  it("is idempotent — a second run deletes nothing more", async () => {
    const user = await createUser();
    await createSessionForUser(user.id, {
      expires_at: new Date(Date.now() - DAY_MS),
    });
    await createSessionForUser(user.id);

    await cleanupExpiredSessions();
    const second = await cleanupExpiredSessions();

    expect(second.deletedCount).toBe(0);
    expect(await countSessionsForUser(user.id)).toBe(1);
  });

  it("supports dry-run mode without deleting rows", async () => {
    const user = await createUser();
    await createSessionForUser(user.id, {
      expires_at: new Date(Date.now() - DAY_MS),
    });
    await createSessionForUser(user.id);

    const result = await cleanupExpiredSessions({ dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(result.deletedCount).toBe(1);
    expect(await countSessionsForUser(user.id)).toBe(2);
  });

  it("respects the batch size across multiple batches", async () => {
    const user = await createUser();
    for (let i = 0; i < 5; i += 1) {
      await createSessionForUser(user.id, {
        expires_at: new Date(Date.now() - DAY_MS),
      });
    }

    const result = await cleanupExpiredSessions({ batchSize: 2 });

    expect(result.deletedCount).toBe(5);
    expect(await countSessionsForUser(user.id)).toBe(0);
  });

  it("honours a provided retention window for revoked sessions", async () => {
    const user = await createUser();
    await createSessionForUser(user.id, {
      revoked_at: new Date(Date.now() - 10 * DAY_MS),
    });

    const wide = await cleanupExpiredSessions({
      revokedRetentionMs: 30 * DAY_MS,
    });
    expect(wide.deletedCount).toBe(0);

    const narrow = await cleanupExpiredSessions({
      revokedRetentionMs: 5 * DAY_MS,
    });
    expect(narrow.deletedCount).toBe(1);
  });

  it("keeps sessions that are neither expired nor long-revoked", async () => {
    const user = await createUser();
    await createSessionForUser(user.id);

    const result = await cleanupExpiredSessions();

    expect(result.deletedCount).toBe(0);
    expect(await countSessionsForUser(user.id)).toBe(1);
  });
});
