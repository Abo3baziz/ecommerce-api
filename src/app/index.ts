import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "../config/env.js";
import { requestId } from "../middleware/requestId.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { errorHandler } from "../middleware/errorHandler.js";
import { logger } from "../shared/logger/index.js";
import { router } from "../routes/index.js";

const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public");

const app = express();

app.use(requestId);

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const context = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: Date.now() - start,
      requestId: req.headers["x-request-id"],
      userId: req.userId,
      ip: req.ip,
      userAgent: req.get("user-agent"),
      err: res.locals.error,
    };

    if (res.statusCode >= 400) {
      logger.error(context, "Request failed");
    } else {
      logger.success(context, "Request completed");
    }
  });
  next();
});

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

if (env.NODE_ENV !== "test") {
  app.use(rateLimiter);
}

app.use("/api", router);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use(express.static(PUBLIC_DIR));
app.get("/verify-email", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "verify-email.html"));
});
app.get("/verify-email-change", (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "verify-email-change.html"));
});
app.get("/reset-password", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.sendFile(path.join(PUBLIC_DIR, "reset-password.html"));
});

app.use(errorHandler);

export { app };
