import { createServer } from "./server.js";
import { flushLogger, logger } from "./shared/logger/index.js";

// Bounded crash exit: give the async file sink a short window to persist the
// fatal entry, then force exit so a wedged stream can never hang the process.
const CRASH_FLUSH_TIMEOUT_MS = 1000;

function exitAfterFlush(code: number): void {
  const forced = setTimeout(() => process.exit(code), CRASH_FLUSH_TIMEOUT_MS);
  forced.unref();

  void flushLogger()
    .catch(() => undefined)
    .finally(() => process.exit(code));
}

process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "Unhandled rejection");
  exitAfterFlush(1);
});

process.on("uncaughtException", (error) => {
  logger.fatal({ err: error }, "Uncaught exception");
  exitAfterFlush(1);
});

createServer();
