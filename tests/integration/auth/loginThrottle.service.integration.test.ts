import { describe, it, expect, beforeEach, vi } from "vitest";
import { login } from "../../../src/modules/auth/service/auth.service.js";
import {
  clearLoginFailures,
  resetLoginAttemptsForTests,
} from "../../../src/modules/auth/utils/loginAttemptTracker.js";
import {
  LOGIN_LOCKOUT_MS,
  LOGIN_MAX_FAILED_ATTEMPTS,
} from "../../../src/shared/constants/index.js";
import { TooManyRequestsError } from "../../../src/shared/errors/TooManyRequestsError.js";
import { UnauthorizedError } from "../../../src/shared/errors/UnauthorizedError.js";
import { createUser, TEST_PASSWORD } from "../../factories/user.factory.js";
import { cleanupTestData } from "../../helpers/db.js";

vi.mock("../../../src/shared/mailer/index.js", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

const CONTEXT = { ip: "127.0.0.1", userAgent: "test-agent" };

async function failLoginTimes(email: string, times: number): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await expect(
      login({ email, password: "definitely-wrong" }, CONTEXT),
    ).rejects.toThrow(UnauthorizedError);
  }
}

describe("auth.service login brute-force throttling", () => {
  beforeEach(async () => {
    await cleanupTestData();
    resetLoginAttemptsForTests();
  });

  it("locks the account after the failure threshold even with correct credentials", async () => {
    const user = await createUser();

    await failLoginTimes(user.email, LOGIN_MAX_FAILED_ATTEMPTS);

    await expect(
      login({ email: user.email, password: TEST_PASSWORD }, CONTEXT),
    ).rejects.toThrow(TooManyRequestsError);
  });

  it("locks unknown emails too without revealing account existence", async () => {
    const email = "test-ghost-lock@example.com";

    await failLoginTimes(email, LOGIN_MAX_FAILED_ATTEMPTS);

    await expect(
      login({ email, password: "whatever" }, CONTEXT),
    ).rejects.toThrow("Too many failed login attempts");
  });

  it("resets the failure counter after a successful login", async () => {
    const user = await createUser();

    await failLoginTimes(user.email, LOGIN_MAX_FAILED_ATTEMPTS - 1);

    const result = await login(
      { email: user.email, password: TEST_PASSWORD },
      CONTEXT,
    );
    expect(result.public_id).toMatch(/^usr_/);

    await failLoginTimes(user.email, LOGIN_MAX_FAILED_ATTEMPTS - 1);

    const secondLogin = await login(
      { email: user.email, password: TEST_PASSWORD },
      CONTEXT,
    );
    expect(secondLogin.public_id).toBe(result.public_id);
  });

  it("keys the counter case-insensitively", async () => {
    const user = await createUser();
    const mixedCase = user.email.replace(/^(.)/, (char) => char.toUpperCase());

    await failLoginTimes(mixedCase, LOGIN_MAX_FAILED_ATTEMPTS);

    await expect(
      login({ email: user.email, password: TEST_PASSWORD }, CONTEXT),
    ).rejects.toThrow(TooManyRequestsError);
  });

  it("unlocks after the lockout expires and starts a fresh cycle", async () => {
    const user = await createUser();

    await failLoginTimes(user.email, LOGIN_MAX_FAILED_ATTEMPTS);

    await expect(
      login({ email: user.email, password: TEST_PASSWORD }, CONTEXT),
    ).rejects.toThrow(TooManyRequestsError);

    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(Date.now() + LOGIN_LOCKOUT_MS + 1_000);

      const result = await login(
        { email: user.email, password: TEST_PASSWORD },
        CONTEXT,
      );
      expect(result.public_id).toMatch(/^usr_/);

      await failLoginTimes(user.email, LOGIN_MAX_FAILED_ATTEMPTS - 1);

      const afterFreshCycle = await login(
        { email: user.email, password: TEST_PASSWORD },
        CONTEXT,
      );
      expect(afterFreshCycle.public_id).toBe(result.public_id);
    } finally {
      vi.useRealTimers();
      clearLoginFailures(user.email);
    }
  });
});
