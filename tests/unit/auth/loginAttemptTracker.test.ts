import { describe, it, expect, beforeEach } from "vitest";
import {
  clearLoginFailures,
  isLoginLocked,
  recordLoginFailure,
  resetLoginAttemptsForTests,
} from "../../../src/modules/auth/utils/loginAttemptTracker.js";
import {
  LOGIN_LOCKOUT_MS,
  LOGIN_MAX_FAILED_ATTEMPTS,
} from "../../../src/shared/constants/index.js";

const EMAIL = "test-lockout@example.com";
const START = 1_700_000_000_000;

describe("loginAttemptTracker", () => {
  beforeEach(() => {
    resetLoginAttemptsForTests();
  });

  it("does not lock before the failure threshold", () => {
    for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS - 1; i += 1) {
      recordLoginFailure(EMAIL, START);
      expect(isLoginLocked(EMAIL, START)).toBe(0);
    }
  });

  it("locks temporarily once the failure threshold is reached", () => {
    for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS; i += 1) {
      recordLoginFailure(EMAIL, START);
    }

    expect(isLoginLocked(EMAIL, START)).toBe(Math.ceil(LOGIN_LOCKOUT_MS / 1000));
  });

  it("reports a decreasing retry-after and unlocks after the lockout expires", () => {
    for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS; i += 1) {
      recordLoginFailure(EMAIL, START);
    }

    const halfway = isLoginLocked(EMAIL, START + Math.floor(LOGIN_LOCKOUT_MS / 2));
    expect(halfway).toBeGreaterThan(0);
    expect(halfway).toBeLessThan(Math.ceil(LOGIN_LOCKOUT_MS / 1000));

    expect(isLoginLocked(EMAIL, START + LOGIN_LOCKOUT_MS)).toBe(0);
    expect(isLoginLocked(EMAIL, START + LOGIN_LOCKOUT_MS + 60_000)).toBe(0);
  });

  it("clears the counter on success so a later burst starts from zero", () => {
    for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS - 1; i += 1) {
      recordLoginFailure(EMAIL, START);
    }

    clearLoginFailures(EMAIL);

    for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS - 1; i += 1) {
      recordLoginFailure(EMAIL, START);
      expect(isLoginLocked(EMAIL, START)).toBe(0);
    }
  });

  it("keys failures case-insensitively", () => {
    for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS - 1; i += 1) {
      recordLoginFailure("Test-Lockout@Example.com", START);
    }

    recordLoginFailure(EMAIL, START);

    expect(isLoginLocked(" TEST-lockout@example.com ", START)).toBe(
      Math.ceil(LOGIN_LOCKOUT_MS / 1000),
    );
  });

  it("tracks emails independently", () => {
    for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS; i += 1) {
      recordLoginFailure(EMAIL, START);
    }

    expect(isLoginLocked(EMAIL, START)).toBeGreaterThan(0);
    expect(isLoginLocked("other@example.com", START)).toBe(0);
  });

  it("counts failures for unknown emails as well as known ones", () => {
    for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS; i += 1) {
      recordLoginFailure("ghost@example.com", START);
    }

    expect(isLoginLocked("ghost@example.com", START)).toBeGreaterThan(0);
  });

  it("does not extend an active lockout with further failures", () => {
    for (let i = 0; i < LOGIN_MAX_FAILED_ATTEMPTS; i += 1) {
      recordLoginFailure(EMAIL, START);
    }

    const initialRetryAfter = isLoginLocked(EMAIL, START);

    recordLoginFailure(EMAIL, START + 10_000);
    recordLoginFailure(EMAIL, START + 20_000);

    expect(isLoginLocked(EMAIL, START)).toBe(initialRetryAfter);
  });
});
