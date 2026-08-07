import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "../config/env.js";
import { requestId } from "../middleware/requestId.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { errorHandler } from "../middleware/errorHandler.js";
import { logger } from "../shared/logger/index.js";
import { router } from "../routes/index.js";

const app = express();

app.use(requestId);

app.use((req, _res, next) => {
  const start = Date.now();
  _res.on("finish", () => {
    logger.info({
      method: req.method,
      url: req.originalUrl,
      status: _res.statusCode,
      duration: Date.now() - start,
      requestId: req.headers["x-request-id"],
    });
  });
  next();
});

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(rateLimiter);

app.use("/api", router);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(errorHandler);

export { app };
