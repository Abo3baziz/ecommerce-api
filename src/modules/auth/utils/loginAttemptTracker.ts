import { createHash } from "node:crypto";
import { LOGIN_MAX_FAILED_ATTEMPTS, LOGIN_LOCKOUT_MS } from "../../../shared/constants/index.js";

interface LoginFailureRecord {
  count: number;
  lockedUntil: number | null;
  lastFailureAt: number;
}

const FAILURE_RECORD_TTL_MS = LOGIN_LOCKOUT_MS;

const MAX_TRACKED_KEYS = 10_000;

const failures = new Map<string, LoginFailureRecord>();

function failureKey(email: string): string {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex");
}

function purgeExpired(now: number): void {
  for (const [key, record] of failures) {
    const lockActive = record.lockedUntil !== null && record.lockedUntil > now;
    if (!lockActive && now - record.lastFailureAt > FAILURE_RECORD_TTL_MS) {
      failures.delete(key);
    }
  }
}

export function isLoginLocked(email: string, now: number = Date.now()): number {
  const record = failures.get(failureKey(email));

  if (!record || record.lockedUntil === null) {
    return 0;
  }

  if (record.lockedUntil <= now) {
    return 0;
  }

  return Math.ceil((record.lockedUntil - now) / 1000);
}

export function recordLoginFailure(email: string, now: number = Date.now()): void {
  if (failures.size >= MAX_TRACKED_KEYS) {
    purgeExpired(now);
  }

  const key = failureKey(email);
  const record = failures.get(key);

  if (isLoginLocked(email, now) > 0) {
    return;
  }

  if (!record) {
    failures.set(key, {
      count: 1,
      lockedUntil: null,
      lastFailureAt: now,
    });
    return;
  }

  const count = record.count + 1;
  const lockedUntil =
    count >= LOGIN_MAX_FAILED_ATTEMPTS ? now + LOGIN_LOCKOUT_MS : null;

  failures.set(key, { count, lockedUntil, lastFailureAt: now });
}

export function clearLoginFailures(email: string): void {
  failures.delete(failureKey(email));
}

export function resetLoginAttemptsForTests(): void {
  failures.clear();
}
