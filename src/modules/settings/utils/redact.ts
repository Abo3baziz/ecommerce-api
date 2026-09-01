import { isEncryptedPayload } from "./encryption.js";

export const MASKED_SENTINEL = "[redacted]";

/**
 * Field names that hold secrets. Exact matches only — substring matching
 * corrupted boolean settings such as `notifications.password_reset`.
 */
const SECRET_FIELD_NAMES = new Set([
  "provider_secret_key",
  "webhook_secret",
  "smtp_password",
  "secret",
  "password",
  "token",
  "api_key",
]);

/**
 * Free-form provider config objects may hold arbitrary credential keys, so
 * inside those a broader pattern is applied.
 */
const SECRET_KEY_PATTERN = /secret|password|api_key|private_key|credential|webhook/i;

const MAX_DEPTH = 6;

type MaskOptions = {
  /** Inside free-form config objects, secret-looking keys are also masked. */
  inFreeFormConfig?: boolean;
  depth?: number;
};

function isSecretKey(key: string, inFreeFormConfig: boolean): boolean {
  if (SECRET_FIELD_NAMES.has(key.toLowerCase())) return true;
  return inFreeFormConfig && SECRET_KEY_PATTERN.test(key.toLowerCase());
}

/**
 * A value is only maskable when it could hold a secret: a non-empty string or
 * an encrypted payload. Booleans/numbers (e.g. notification toggles) and
 * nested structures pass through untouched.
 */
function isMaskableValue(value: unknown): boolean {
  if (typeof value === "string" && value !== "") return true;
  return isEncryptedPayload(value);
}

function walk(
  value: unknown,
  mask: (v: unknown) => unknown,
  opts: MaskOptions,
): unknown {
  const { inFreeFormConfig = false, depth = 0 } = opts;
  if (depth > MAX_DEPTH) return value;
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => walk(v, mask, { ...opts, depth: depth + 1 }));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (isSecretKey(k, inFreeFormConfig) && isMaskableValue(v)) {
        out[k] = mask(v);
      } else if (typeof v === "object" && v !== null) {
        out[k] = walk(v, mask, { ...opts, inFreeFormConfig: inFreeFormConfig || k === "provider_config", depth: depth + 1 });
      } else {
        out[k] = v;
      }
    }
    return out;
  }
  return value;
}

/**
 * Masks secret values for API responses. Only known secret field names (exact
 * match) or secret-looking keys inside free-form provider config objects are
 * masked — boolean/numeric settings are never touched.
 */
export function maskSecrets<T>(value: T): T {
  return walk(value, () => MASKED_SENTINEL, {}) as T;
}

/**
 * Deep-redaction for audit persistence: same rules as masking, but any masked
 * value becomes the sentinel regardless of original shape.
 */
export function redactValue<T>(value: T): T {
  return walk(
    value,
    () => MASKED_SENTINEL,
    { inFreeFormConfig: true },
  ) as T;
}

/**
 * Per-field diff between two ALREADY-REDACTED values. Secret fields appear as
 * the sentinel on both sides, so raw secrets can never reach the audit log.
 */
export function buildRedactedChanges(
  prev: unknown,
  next: unknown,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  const p = (prev as Record<string, unknown>) ?? {};
  const n = (next as Record<string, unknown>) ?? {};
  for (const k of new Set([...Object.keys(p), ...Object.keys(n)])) {
    if (JSON.stringify(p[k]) !== JSON.stringify(n[k])) {
      changes[k] = { from: p[k] ?? null, to: n[k] ?? null };
    }
  }
  return changes;
}
