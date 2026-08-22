import type { Request, Response, NextFunction } from "express";
import type { users } from "../generated/prisma/client.js";
import { recordAuditEvent } from "../modules/audit/service/audit.service.js";

const MUTATION_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const SENSITIVE_KEY_PATTERN = /password|secret|token|otp/i;
const MAX_BODY_DEPTH = 6;

const SEGMENT_TO_ENTITY: Record<string, string> = {
  products: "product",
  categories: "category",
  inventory: "inventory",
  orders: "order",
  reviews: "review",
  users: "customer",
};

interface ClassifiedRequest {
  action: string;
  entityType: string | null;
  entityPublicId: string | null;
}

// Derives a semantic action name and target entity from the request path.
// Special cases encode the privileged flows that matter most in review:
// role changes, suspensions, order status transitions, manual reserve changes,
// and category-product assignment.
export function classifyAdminMutation(
  method: string,
  pathname: string,
): ClassifiedRequest {
  const match = pathname.match(/\/api\/v1\/admin\/([^/?]+)/);
  const parts = (match?.[1] ?? "")
    .split("?")[0]
    .split("/")
    .filter(Boolean);

  const segment = parts[0] ?? "unknown";
  const base = `admin.${segment}`;
  const verb =
    method === "POST"
      ? "create"
      : method === "DELETE"
        ? "delete"
        : "update";

  const entityType = SEGMENT_TO_ENTITY[segment] ?? segment;

  // Deepest id wins for nested resources (variants, images, linked products).
  const idLike = [...parts].reverse().find((part) => /^[a-z]{2,5}_/.test(part));
  const entityPublicId =
    parts.length >= 2 ? (idLike ?? parts[1] ?? null) : null;

  if (segment === "users" && parts[2] !== undefined) {
    if (parts[2] === "role") {
      return { action: `${base}.role_change`, entityType, entityPublicId };
    }
    if (parts[2] === "suspend") {
      return { action: `${base}.suspend`, entityType, entityPublicId };
    }
    if (parts[2] === "activate") {
      return { action: `${base}.activate`, entityType, entityPublicId };
    }
  }

  if (segment === "inventory" && parts[2] === "reserve") {
    return { action: `${base}.reserve_change`, entityType, entityPublicId };
  }

  if (segment === "orders" && method === "PATCH" && parts[1] !== undefined) {
    return { action: `${base}.status_transition`, entityType, entityPublicId };
  }

  if (
    segment === "categories" &&
    parts[1] !== undefined &&
    parts[2] === "products" &&
    (method === "PUT" || method === "DELETE")
  ) {
    return {
      action: method === "PUT" ? `${base}.assign_product` : `${base}.remove_product`,
      entityType,
      entityPublicId,
    };
  }

  return { action: `${base}.${verb}`, entityType, entityPublicId };
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_BODY_DEPTH) return "[truncated]";
  if (Array.isArray(value)) {
    return value.map((item) => redact(item, depth + 1));
  }
  if (typeof value === "object" && value !== null) {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        output[key] = "[redacted]";
      } else {
        output[key] = redact(item, depth + 1);
      }
    }
    return output;
  }
  return value;
}

/**
 * Records one audit row for every authenticated mutating request under
 * /admin/*. Mounted before the admin routers so the body snapshot is taken
 * pre-validation; the actor is read lazily on response finish because the
 * authentication middleware runs later in the chain. Fire-and-forget: audit
 * failures never affect the business response.
 */
export function auditAdminMutations(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!MUTATION_METHODS.has(req.method)) {
    next();
    return;
  }

  const bodySnapshot = redact(req.body);
  const { action, entityType, entityPublicId } = classifyAdminMutation(
    req.method,
    req.originalUrl,
  );

  res.on("finish", () => {
    const actor = req.user as users | undefined;
    if (!actor) return;

    void recordAuditEvent({
      actorUsersId: actor.id,
      action,
      entityType,
      entityPublicId,
      method: req.method,
      path: req.originalUrl.slice(0, 255),
      statusCode: res.statusCode,
      requestBody: bodySnapshot,
      ipAddress: req.ip ?? null,
      userAgent: req.get("user-agent") ?? null,
    });
  });

  next();
}
