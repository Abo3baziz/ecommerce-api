import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { prisma } from "../src/config/database.js";
import { cleanupExpiredSessions } from "../src/modules/auth/service/sessionCleanup.service.js";
import { REVOKED_SESSION_RETENTION_MS } from "../src/shared/constants/session.js";
import { logger } from "../src/shared/logger/index.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CleanupCliOptions {
  dryRun: boolean;
  batchSize: number;
  revokedRetentionDays: number;
}

export interface CleanupCliOutcome {
  exitCode: number;
  messages: string[];
}

export function parseCleanupArgs(argv: string[]): CleanupCliOptions | string {
  let dryRun = false;
  let batchSize = 1000;
  let revokedRetentionDays = Math.floor(
    REVOKED_SESSION_RETENTION_MS / DAY_MS,
  );

  for (const arg of argv) {
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    const batchMatch = arg.match(/^--batch-size=(\d+)$/);
    if (batchMatch) {
      batchSize = Number(batchMatch[1]);
      continue;
    }

    const retentionMatch = arg.match(/^--revoked-retention-days=(\d+)$/);
    if (retentionMatch) {
      revokedRetentionDays = Number(retentionMatch[1]);
      continue;
    }

    return `Unknown argument: ${arg}`;
  }

  if (batchSize < 1) {
    return "batch-size must be a positive integer.";
  }

  if (revokedRetentionDays < 0) {
    return "revoked-retention-days must be a non-negative integer.";
  }

  return { dryRun, batchSize, revokedRetentionDays };
}

export async function runSessionCleanup(
  argv: string[],
): Promise<CleanupCliOutcome> {
  const parsed = parseCleanupArgs(argv);

  if (typeof parsed === "string") {
    return {
      exitCode: 1,
      messages: [`Error: ${parsed}`, "No changes were made."],
    };
  }

  try {
    const result = await cleanupExpiredSessions({
      dryRun: parsed.dryRun,
      batchSize: parsed.batchSize,
      revokedRetentionMs: parsed.revokedRetentionDays * DAY_MS,
    });

    const messages = [
      `Session cleanup ${parsed.dryRun ? "(DRY RUN — no rows deleted)" : ""}`,
      `Eligible sessions processed: ${result.deletedCount}`,
      `Batch size: ${parsed.batchSize}`,
      `Revoked-session retention: ${parsed.revokedRetentionDays} day(s)`,
    ];

    return { exitCode: 0, messages };
  } catch (error) {
    logger.error({ err: error }, "Session cleanup failed");

    return {
      exitCode: 1,
      messages: [
        "An error occurred while cleaning up sessions.",
        "No changes were made.",
      ],
    };
  }
}

async function main(): Promise<void> {
  const outcome = await runSessionCleanup(process.argv.slice(2));

  for (const message of outcome.messages) {
    console.log(message);
  }

  process.exitCode = outcome.exitCode;
}

const isDirectRun =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isDirectRun) {
  main().catch((error: unknown) => {
    logger.error({ err: error }, "Session cleanup CLI failed");

    console.error("An unexpected error occurred.");
    process.exitCode = 1;
  });
}
