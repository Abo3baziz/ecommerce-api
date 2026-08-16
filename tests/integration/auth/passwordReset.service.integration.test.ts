import { describe, it, expect, beforeEach, vi } from "vitest";
import { nanoid } from "nanoid";
import {
  login,
  requestPasswordReset,
  verifyPasswordReset,
} from "../../../src/modules/auth/service/auth.service.js";
import { sendPasswordResetEmail } from "../../../src/shared/mailer/passwordReset.js";
import {
  generateOpaqueToken,
} from "../../../src/modules/auth/utils/tokens.js";
import { prisma } from "../../../src/config/database.js";
import { GoneError } from "../../../src/shared/errors/GoneError.js";
import { NotFoundError } from "../../../src/shared/errors/NotFoundError.js";
import { UnauthorizedError } from "../../../src/shared/errors/UnauthorizedError.js";
import {
  user_status,
  verification_type,
} from "../../../src/generated/prisma/enums.js";
import { createUser, TEST_PASSWORD } from "../../factories/user.factory.js";
import { createSessionForUser } from "../../factories/session.factory.js";
import { createVerificationToken } from "../../factories/verification-token.factory.js";
import { cleanupTestData } from "../../helpers/db.js";

vi.mock("../../../src/shared/mailer/passwordReset.js", () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

const RESET_MESSAGE =
  "If an account exists for the provided email, a password reset email has been sent.";
const NEW_PASSWORD = "NewStrongPassword456!";
const CONTEXT = { ip: "127.0.0.1", userAgent: "test-agent" };

function capturedResetToken(): string {
  const calls = vi.mocked(sendPasswordResetEmail).mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls.at(-1)![2];
}

describe("auth.service password reset", () => {
  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
  });

  describe("requestPasswordReset", () => {
    it("issues a PASSWORD_RESET token and sends an email for an active user", async () => {
      const user = await createUser({ email: `test-${nanoid(8)}@example.com` });

      const result = await requestPasswordReset({ email: user.email });

      expect(result.message).toBe(RESET_MESSAGE);
      expect(sendPasswordResetEmail).toHaveBeenCalledTimes(1);
      expect(sendPasswordResetEmail).toHaveBeenCalledWith(
        user.email,
        user.first_name,
        expect.stringMatching(/^[0-9a-f]{64}$/),
      );

      const token = await prisma.verification_tokens.findFirst({
        where: { users_id: user.id, purpose: verification_type.PASSWORD_RESET },
      });
      expect(token).not.toBeNull();
      expect(token!.target).toBe(user.email);
      expect(token!.used_at).toBeNull();
      expect(token!.verified_at).toBeNull();
      expect(token!.expires_at.getTime()).toBeGreaterThan(Date.now());
    });

    it("returns the same message for an unknown email and sends no email", async () => {
      const result = await requestPasswordReset({
        email: `test-${nanoid(8)}@example.com`,
      });

      expect(result.message).toBe(RESET_MESSAGE);
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it("returns the same message for a suspended user and sends no email", async () => {
      const user = await createUser({
        email: `test-${nanoid(8)}@example.com`,
        status: user_status.SUSPENDED,
      });

      const result = await requestPasswordReset({ email: user.email });

      expect(result.message).toBe(RESET_MESSAGE);
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it("invalidates previous unused reset tokens when a new one is issued", async () => {
      const user = await createUser({ email: `test-${nanoid(8)}@example.com` });

      await requestPasswordReset({ email: user.email });
      const firstToken = await prisma.verification_tokens.findFirst({
        where: { users_id: user.id, purpose: verification_type.PASSWORD_RESET },
      });

      await requestPasswordReset({ email: user.email });

      const updated = await prisma.verification_tokens.findUnique({
        where: { id: firstToken!.id },
      });
      expect(updated!.used_at).not.toBeNull();

      const remaining = await prisma.verification_tokens.findMany({
        where: {
          users_id: user.id,
          purpose: verification_type.PASSWORD_RESET,
          used_at: null,
        },
      });
      expect(remaining).toHaveLength(1);
    });
  });

  describe("verifyPasswordReset", () => {
    it("updates the password, revokes all sessions, and invalidates the token", async () => {
      const user = await createUser({ email: `test-${nanoid(8)}@example.com` });
      const { session } = await createSessionForUser(user.id);
      const resetToken = generateOpaqueToken();
      await createVerificationToken({
        usersId: user.id,
        rawToken: resetToken,
        purpose: verification_type.PASSWORD_RESET,
        target: user.email,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      await verifyPasswordReset({ token: resetToken, new_password: NEW_PASSWORD });

      const updated = await prisma.users.findUnique({ where: { id: user.id } });
      expect(updated!.password_hash).not.toBe(user.password_hash);

      const staleSession = await prisma.sessions.findUnique({
        where: { id: session.id },
      });
      expect(staleSession!.revoked_at).not.toBeNull();

      const token = await prisma.verification_tokens.findFirst({
        where: { users_id: user.id, purpose: verification_type.PASSWORD_RESET },
      });
      expect(token!.used_at).not.toBeNull();
      expect(token!.verified_at).not.toBeNull();

      await expect(
        login({ email: user.email, password: TEST_PASSWORD }, CONTEXT),
      ).rejects.toBeInstanceOf(UnauthorizedError);

      const newLogin = await login(
        { email: user.email, password: NEW_PASSWORD },
        CONTEXT,
      );
      expect(newLogin.sessionToken).toMatch(/^[0-9a-f]{64}$/);
    });

    it("throws NotFoundError for an unknown token", async () => {
      await createUser();

      await expect(
        verifyPasswordReset({
          token: generateOpaqueToken(),
          new_password: NEW_PASSWORD,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws GoneError for a used token", async () => {
      const user = await createUser();
      const resetToken = generateOpaqueToken();
      await createVerificationToken({
        usersId: user.id,
        rawToken: resetToken,
        purpose: verification_type.PASSWORD_RESET,
        target: user.email,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: new Date(),
      });

      await expect(
        verifyPasswordReset({ token: resetToken, new_password: NEW_PASSWORD }),
      ).rejects.toBeInstanceOf(GoneError);
    });

    it("throws GoneError for an expired token", async () => {
      const user = await createUser();
      const resetToken = generateOpaqueToken();
      await createVerificationToken({
        usersId: user.id,
        rawToken: resetToken,
        purpose: verification_type.PASSWORD_RESET,
        target: user.email,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        verifyPasswordReset({ token: resetToken, new_password: NEW_PASSWORD }),
      ).rejects.toBeInstanceOf(GoneError);
    });
  });
});