import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { env } from "../../config/env.js";

const LOG_DIR = join(process.cwd(), "logs");
const LOG_FILE = join(LOG_DIR, "logs.json");

const LEVELS: Record<string, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const CONSOLE_LEVELS: Record<string, "log" | "warn" | "error"> = {
  info: "log",
  warn: "warn",
  error: "error",
  fatal: "error",
};

const configuredLevel = LEVELS[env.LOG_LEVEL] ?? LEVELS.info;

type LogContext = Record<string, unknown>;

function serializeError(error: Error): LogContext {
  return {
    type: error.constructor?.name ?? "Error",
    message: error.message,
    stack: error.stack,
  };
}

function buildEntry(level: string, args: unknown[]): LogContext | null {
  const entry: LogContext = {
    timestamp: new Date().toISOString(),
    level,
  };

  for (const arg of args) {
    if (typeof arg === "string") {
      entry.message = arg;
    } else if (arg instanceof Error) {
      entry.err = serializeError(arg);
    } else if (arg && typeof arg === "object") {
      Object.assign(entry, arg);
    }
  }

  return entry;
}

function log(level: string, ...args: unknown[]): void {
  if ((LEVELS[level] ?? LEVELS.info) < configuredLevel) {
    return;
  }

  const entry = buildEntry(level, args);
  const line = JSON.stringify(entry, (_key, value) =>
    value instanceof Error ? serializeError(value) : value,
  );

  try {
    mkdirSync(LOG_DIR, { recursive: true });
    appendFileSync(LOG_FILE, `${line}\n`, "utf8");
  } catch (error) {
    console.error("Failed to write log entry:", error);
  }

  const consoleMethod = CONSOLE_LEVELS[level] ?? "log";
  console[consoleMethod](line);
}

export const logger = {
  trace: (...args: unknown[]) => log("trace", ...args),
  debug: (...args: unknown[]) => log("debug", ...args),
  info: (...args: unknown[]) => log("info", ...args),
  warn: (...args: unknown[]) => log("warn", ...args),
  error: (...args: unknown[]) => log("error", ...args),
  fatal: (...args: unknown[]) => log("fatal", ...args),
};
