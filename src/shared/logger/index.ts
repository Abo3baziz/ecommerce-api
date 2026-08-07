import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import pino from "pino";
import pinoPretty from "pino-pretty";
import { env } from "../../config/env.js";

const LOG_DIR = join(process.cwd(), "logs");
const LOG_FILE = join(LOG_DIR, "log.json");

const CATEGORIES = ["success", "info", "warning", "error", "debug"] as const;
type Category = (typeof CATEGORIES)[number];

const EMPTY_LOG_FILE: Record<Category, Record<string, unknown>> = {
  success: {},
  info: {},
  warning: {},
  error: {},
  debug: {},
};

const includeStack = env.NODE_ENV !== "production";

function toCategory(level: string): Category {
  switch (level) {
    case "success":
      return "success";
    case "warn":
    case "warning":
      return "warning";
    case "error":
    case "fatal":
      return "error";
    case "trace":
    case "debug":
      return "debug";
    default:
      return "info";
  }
}

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

function toRecord(entry: Record<string, unknown>): Record<string, unknown> {
  const record: Record<string, unknown> = {
    timestamp: new Date(Number(entry.time) || Date.now()).toISOString(),
    level: entry.level,
    message: entry.msg,
  };

  const commonFields = [
    "requestId",
    "method",
    "url",
    "status",
    "duration",
    "userId",
    "ip",
    "userAgent",
  ] as const;

  for (const field of commonFields) {
    if (entry[field] !== undefined) {
      record[field] = entry[field];
    }
  }

  if (entry.err && typeof entry.err === "object") {
    record.error = entry.err;
  }

  return record;
}

function normalizeDocument(
  parsed: unknown,
): Record<Category, Record<string, unknown>> {
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const document = { ...EMPTY_LOG_FILE };
    for (const category of CATEGORIES) {
      const section = (parsed as Record<string, unknown>)[category];
      if (section && typeof section === "object" && !Array.isArray(section)) {
        document[category] = section as Record<string, unknown>;
      }
    }
    return document;
  }
  return structuredClone(EMPTY_LOG_FILE);
}

async function appendEntry(line: string): Promise<void> {
  try {
    const parsed = JSON.parse(line) as Record<string, unknown>;
    const category = toCategory(String(parsed.level ?? "info"));
    const record = toRecord(parsed);

    await mkdir(LOG_DIR, { recursive: true });

    let document: Record<Category, Record<string, unknown>>;
    try {
      const raw = await readFile(LOG_FILE, "utf8");
      document = normalizeDocument(JSON.parse(raw) as unknown);
    } catch {
      document = structuredClone(EMPTY_LOG_FILE);
    }

    const section = document[category];
    const keys = Object.keys(section);
    const nextKey =
      keys.length === 0
        ? 1
        : Math.max(...keys.map((key) => Number.parseInt(key, 10) || 0)) + 1;
    section[String(nextKey)] = record;

    await writeFile(LOG_FILE, JSON.stringify(document, null, 2), "utf8");
  } catch {
    // Logging failures must never crash the application.
  }
}

let pendingWrite: Promise<void> = Promise.resolve();

const logFileStream: pino.DestinationStream = {
  write(line: string) {
    pendingWrite = pendingWrite.then(() => appendEntry(line)).catch(() => undefined);
  },
};

const terminalStream: pino.DestinationStream =
  env.NODE_ENV === "production"
    ? process.stdout
    : pinoPretty({ translateTime: "SYS:standard", colorize: true, ignore: "pid,hostname" });

export const logger = pino(
  {
    level: env.LOG_LEVEL,
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
  pino.multistream([
    { stream: terminalStream },
    { stream: logFileStream },
  ]),
);
