import { Server } from "node:http";
import { app } from "./app/index.js";
import { env } from "./config/env.js";
import { logger } from "./shared/logger/index.js";

export function createServer(): Server {
  const server = app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });

  const shutdown = (signal: string): void => {
    logger.info(`Received ${signal}, shutting down gracefully`);
    server.close(() => {
      logger.info("Server shut down");
      process.exit(0);
    });
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  return server;
}
