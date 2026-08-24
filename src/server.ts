import { Server } from "node:http";
import { app } from "./app/index.js";
import { env } from "./config/env.js";
import { prisma } from "./config/database.js";
import { logger, flushLogger } from "./shared/logger/index.js";

// Bounded shutdown: SIGTERM/SIGINT must always terminate the process within
// this window even if keep-alive sockets or in-flight requests linger.
const SHUTDOWN_TIMEOUT_MS = 10_000;

export function createServer(): Server {
  if (!env.ENABLE_CSRF) {
    if (env.NODE_ENV === "production") {
      // Fail-closed: CSRF protection must never be disabled in production.
      logger.fatal("ENABLE_CSRF=false is not allowed in production");
      process.exit(1);
    }
    logger.warn("CSRF protection is DISABLED — development use only");
  }

  const server = app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    logger.info({ signal }, "Received shutdown signal, shutting down gracefully");

    const forceExit = setTimeout(() => {
      logger.error("Graceful shutdown timed out; forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    // Stop intake, then release idle keep-alive sockets so server.close()
    // can actually complete instead of waiting on them forever.
    server.closeIdleConnections?.();

    server.close(async () => {
      try {
        await Promise.race([
          prisma.$disconnect(),
          new Promise((_, reject) =>
            setTimeout(
              () => reject(new Error("prisma.$disconnect timed out")),
              SHUTDOWN_TIMEOUT_MS / 2,
            ),
          ),
        ]);
      } catch (error) {
        logger.error(
          { err: error instanceof Error ? error.message : String(error) },
          "Error while disconnecting Prisma during shutdown",
        );
      }

      clearTimeout(forceExit);
      await flushLogger();
      logger.info("Server shut down");
      process.exit(0);
    });

    // Destroy any remaining sockets once the grace period elapses.
    setTimeout(() => {
      server.closeAllConnections?.();
    }, SHUTDOWN_TIMEOUT_MS / 2).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  return server;
}
