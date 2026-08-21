export const SESSION_COOKIE_NAME = "session";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// Effective session lifetime is min(SESSION_TTL_MS, last_activity_at + this).
// Must stay strictly below SESSION_TTL_MS or the idle check can never fire.
export const SESSION_IDLE_TIMEOUT_MS = 14 * 24 * 60 * 60 * 1000;

export const REVOKED_SESSION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export const CSRF_COOKIE_NAME = "x-csrf-token";

export const CSRF_TOKEN_HEADER = "x-csrf-token";
