import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "../config/env.js";
import { prisma } from "../config/database.js";
import { requestId } from "../middleware/requestId.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { errorHandler } from "../middleware/errorHandler.js";
import { logger } from "../shared/logger/index.js";
import { stripUrlQuery } from "../shared/logger/redact.js";
import { router } from "../routes/index.js";

const PUBLIC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public");

const app = express();

// Client-IP resolution for rate limiting, logs and session records. Must run
// before any middleware reads req.ip.
if (env.TRUST_PROXY !== false) {
  app.set("trust proxy", env.TRUST_PROXY);
}

app.use(requestId);

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const context = {
      method: req.method,
      // Query strings carry single-use credentials (email-verification and
      // reset tokens); persist the pathname only.
      url: stripUrlQuery(req.originalUrl),
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

// Health probes live above the global rate limiter: LB/uptime checks come
// from one IP and would otherwise 429-flap a healthy instance (T-052).
const DB_PROBE_TIMEOUT_MS = 2000;

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/health/ready", async (_req, res) => {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("database probe timed out")),
          DB_PROBE_TIMEOUT_MS,
        ),
      ),
    ]);
    res.json({ status: "ok", db: "up" });
  } catch {
    res.status(503).json({ status: "degraded", db: "down" });
  }
});

if (env.NODE_ENV !== "test") {
  app.use(rateLimiter);
}

app.use("/api", router);

// Unknown /api routes get the JSON error envelope instead of Express's
// default HTML 404 (T-051). Non-API paths keep their existing behavior.
app.use("/api", (_req, res) => {
  res.status(404).json({ success: false, message: "Not found" });
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
