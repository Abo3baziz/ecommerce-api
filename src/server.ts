import { app } from "./app/index.js";
import { env } from "./config/env.js";
import { logger } from "./shared/logger/index.js";

export function createServer() {
  const server = app.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });

  return server;
}
