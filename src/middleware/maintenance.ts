import type { Request, Response, NextFunction } from "express";
import { settingsRepository } from "../modules/settings/repository/settings.repository.js";

let cached: Record<string, unknown> | null = null;
let cachedAt = 0;
const TTL_MS = 30_000;

// Paths that must stay reachable while the storefront is down:
// - /health: load-balancer probes
// - /api/v1/admin: SUPER_ADMIN console (settings toggles live here)
// - /api/v1/auth: otherwise a SUPER_ADMIN without a live session could not
//   log in to turn maintenance mode back off (lockout bug)
const MAINTENANCE_BYPASS_PREFIXES = ["/health", "/api/v1/admin", "/api/v1/auth"];

export async function maintenanceGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (MAINTENANCE_BYPASS_PREFIXES.some((prefix) => req.originalUrl.startsWith(prefix))) {
    next();
    return;
  }
  try {
    const now = Date.now();
    if (!cached || now - cachedAt > TTL_MS) {
      const row = await settingsRepository.findByKey("general");
      cached = (row?.value as Record<string, unknown>) ?? null;
      cachedAt = now;
    }
    if (cached) {
      const maintenance = (cached as { maintenance_mode?: boolean }).maintenance_mode;
      const active = (cached as { store_active?: boolean }).store_active;
      if (maintenance || active === false) {
        res.status(503).json({ success: false, message: "Store under maintenance" });
        return;
      }
    }
    next();
  } catch {
    next();
  }
}
