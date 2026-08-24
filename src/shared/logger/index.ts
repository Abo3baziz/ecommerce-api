import { appendFile, mkdir, rename, stat } from "node:fs/promises";
import { join } from "node:path";
import pino from "pino";
import pinoPretty from "pino-pretty";
import { env } from "../../config/env.js";

// Append-only NDJSON sink: O(1) per entry, size-rotated, never re-read or
// rewritten (see docs/LOGGER.md). The old categorized log.json design was
// O(n²) per write, unbounded, and corruption-prone.
const LOG_DIR = join(process.cwd(), "logs");
const LOG_FILE = join(LOG_DIR, "app.ndjson");
const MAX_LOG_BYTES = 5 * 1024 * 1024;
const ROTATED_FILES_KEPT = 3;

const includeStack = env.NODE_ENV !== "production";

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const candidate = error as Error & { code?: unknown; details?: unknown };
    return {
      code: typeof candidate.code === "string" ? candidate.code : null,
      message: error.message,
      details: candidate.details ?? null,
      ...(includeStack && error.stack ? { stack: error.stack } : {}),
    };
  }

  return { code: null, message: String(error), details: null };
}

async function rotateIfNeeded(): Promise<void> {
  try {
    const info = await stat(LOG_FILE);
    if (info.size < MAX_LOG_BYTES) {
      return;
    }

    for (let i = ROTATED_FILES_KEPT - 1; i >= 1; i -= 1) {
      try {
        await rename(`${LOG_FILE}.${i}`, `${LOG_FILE}.${i + 1}`);
      } catch {
        // No such rotated file yet; shift the rest.
      }
    }
    await rename(LOG_FILE, `${LOG_FILE}.1`);
  } catch {
    // Current log file does not exist yet — nothing to rotate.
  }
}

let pendingWrite: Promise<void> = Promise.resolve();

const fileSink: pino.DestinationStream = {
  write(line: string) {
    pendingWrite = pendingWrite
      .then(rotateIfNeeded)
      .then(() => appendFile(LOG_FILE, line, "utf8"))
      .catch(() => undefined);
  },
};

const terminalStream: pino.DestinationStream =
  env.NODE_ENV === "production"
    ? process.stdout
    : pinoPretty({ translateTime: "SYS:standard", colorize: true, ignore: "pid,hostname" });

export const logger = pino(
  {
    level: env.NODE_ENV === "test" ? "silent" : env.LOG_LEVEL,
    base: undefined,
    customLevels: { success: 35 },
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    serializers: {
      err: serializeError,
    },
  },
  pino.multistream([{ stream: terminalStream }, { stream: fileSink }]),
);

/**
 * Resolves once every entry queued behind the file sink's write chain has
 * been appended. Crash handlers call this before process.exit so final
 * log lines (e.g. fatal errors) reach disk.
 */
export async function flushLogger(): Promise<void> {
  await pendingWrite;
  await new Promise<void>((resolve) => logger.flush(() => resolve()));
}
