import type { Request, Response, NextFunction } from "express";
import { env } from "../config/env.js";
import { ForbiddenError } from "../shared/errors/ForbiddenError.js";
import { SESSION_COOKIE_NAME } from "../shared/constants/session.js";

/**
 * Public read-only demo mode (recruiter showcase).
 *
 * When ENABLE_DEMO_MODE is on, visitors without a session cookie can read the
 * admin dashboard through a synthetic principal; every mutating request and
 * every sensitive section stays behind real authentication. Two middlewares
 * are mounted on /admin, in this order, BEFORE the admin routers:
 *
 *   1. demoAdminAccess — request admission:
 *      - demo off  → passthrough (normal authentication flow)
 *      - session cookie present → passthrough (real admin, full rights)
 *      - no cookie + write method → 403 (mutations are never public)
 *      - no cookie + sensitive section → 403 (secrets/credentials/staff data)
 *      - no cookie + GET → flags req.isDemoPublicRead so the routers'
 *        authentication middleware can admit the visitor
 *
 *   2. demoResponseSanitizer — response masking: wraps res.json for demo
 *      reads and masks customer PII recursively (emails, phone numbers,
 *      personal names, street/postal address lines).
 *
 * The synthetic principal is declared with role SUPER_ADMIN so aggregate
 * super-admin surfaces (Analytics, Reports) are part of the demo, and it is
 * admitted ONLY for safe methods — the admission middleware never sets the
 * flag for writes, and authentication independently re-checks the method.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// Admin sections that must never be publicly readable, even in demo mode:
// - /settings  → payment/email/provider secrets and platform configuration
// - /admins    → internal staff accounts and activity monitoring
// - /audit     → append-only governance trail (actors, IPs, payloads)
// Plus any signed ImageKit upload credentials (imagekit-auth), which are
// short-lived upload signatures and therefore privileged tokens.
const DEMO_BLOCKED_PREFIXES = ["/settings", "/admins", "/audit"];
const DEMO_BLOCKED_PATH_SNIPPETS = ["imagekit-auth"];

export function isDemoBlockedAdminPath(path: string): boolean {
  const blockedPrefix = DEMO_BLOCKED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
  const blockedSnippet = DEMO_BLOCKED_PATH_SNIPPETS.some((snippet) =>
    path.includes(snippet),
  );
  return blockedPrefix || blockedSnippet;
}

export function demoAdminAccess(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!env.ENABLE_DEMO_MODE) {
    next();
    return;
  }

  const hasSessionCookie = req.cookies[SESSION_COOKIE_NAME] !== undefined;
  if (hasSessionCookie) {
    // A real (or attempted) session: defer to the normal authentication flow.
    next();
    return;
  }

  if (!SAFE_METHODS.has(req.method)) {
    next(new ForbiddenError("Demo mode is read-only"));
    return;
  }

  if (isDemoBlockedAdminPath(req.path)) {
    next(new ForbiddenError("Not available in demo mode"));
    return;
  }

  req.isDemoPublicRead = true;
  next();
}

/**
 * Synthetic principal handed to unauthenticated demo readers. role SUPER_ADMIN
 * unlocks read access to aggregate super-admin endpoints (Analytics, Reports).
 * Internal id is negative so an accidental DB write with this actor fails its
 * FK constraint instead of corrupting data — mutations are already rejected
 * upstream, this is defense in depth.
 */
export const demoPublicPrincipal = Object.freeze({
  id: -1,
  public_id: "demo-public-visitor",
  email: "demo-visitor@localhost",
  phone_number: "",
  first_name: "Demo",
  last_name: "Visitor",
  role: "SUPER_ADMIN",
  status: "ACTIVE",
  email_verified_at: new Date(0),
  phone_verified_at: null,
  created_at: new Date(0),
  updated_at: new Date(0),
  deleted_at: null,
});

// Keys masked unconditionally (no shape heuristics — street addresses can
// legitimately contain digits that would trip the phone-like matcher).
const DEMO_BLANKED_KEYS = new Set([
  "address_1",
  "address_2",
  "address_line_1",
  "address_line_2",
  "street",
  "street_address",
  "postal_code",
  "zip_code",
]);

// Keys whose value is customer PII in admin read responses. Exact matches
// only — generic suffixes like `name` would also mask product/category names.
const DEMO_MASKED_KEYS = new Set([
  // contact identifiers
  "email",
  "customer_email",
  "phone",
  "phone_number",
  "contact_phone",
  // personal names
  "first_name",
  "last_name",
  "customer_name",
  "recipient_name",
  // street/postal address lines (city/state/country stay visible: shipping
  // geography is the point of the dashboard and is weakly identifying)
  ...DEMO_BLANKED_KEYS,
]);

const MAX_MASK_DEPTH = 12;

function maskScalar(key: string, value: unknown): string {
  if (DEMO_BLANKED_KEYS.has(key)) {
    return "***";
  }
  const text = String(value);
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(text)) {
    // Email: keep the first local-part character for a realistic look.
    return `${text.charAt(0)}***@***.***`;
  }
  if (text.length >= 4 && /\d/.test(text)) {
    // Phone-like: keep the last four digits.
    return `***${text.slice(-4)}`;
  }
  if (text.length > 0) {
    return `${text.charAt(0)}***`;
  }
  return "***";
}

function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function maskDemoBody(value: unknown, depth = 0): unknown {
  if (depth > MAX_MASK_DEPTH) {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => maskDemoBody(item, depth + 1));
  }
  // Dates (and class instances generally) must pass through untouched —
  // Object.entries(Date) is empty, so recursing would replace every Date
  // with {} and break the JSON the client renders.
  if (typeof value === "object" && value !== null && isPlainObject(value)) {
    const output: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      output[key] =
        DEMO_MASKED_KEYS.has(key) && item !== null
          ? maskScalar(key, item)
          : maskDemoBody(item, depth + 1);
    }
    return output;
  }
  return value;
}

/**
 * Wraps res.json for demo-public reads so every JSON admin response (lists,
 * details, aggregates) is emitted with customer PII masked.
 */
export function demoResponseSanitizer(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.isDemoPublicRead) {
    next();
    return;
  }

  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => originalJson(maskDemoBody(body))) as typeof res.json;
  next();
}
