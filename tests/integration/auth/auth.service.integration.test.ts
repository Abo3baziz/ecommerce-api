import { describe, it, expect, beforeEach, vi } from "vitest";
import { nanoid } from "nanoid";
import {
  login,
  register,
  resendVerificationEmail,
  revokeAllOtherSessions,
  revokeSession,
  listSessions,
  verifyEmail,
} from "../../../src/modules/auth/service/auth.service.js";
import {
  generateOpaqueToken,
  hashToken,
} from "../../../src/modules/auth/utils/tokens.js";
import { prisma } from "../../../src/config/database.js";
import { ConflictError } from "../../../src/shared/errors/ConflictError.js";
import { ForbiddenError } from "../../../src/shared/errors/ForbiddenError.js";
import { GoneError } from "../../../src/shared/errors/GoneError.js";
import { NotFoundError } from "../../../src/shared/errors/NotFoundError.js";
import { UnauthorizedError } from "../../../src/shared/errors/UnauthorizedError.js";
import {
  user_status,
  verification_type,
} from "../../../src/generated/prisma/enums.js";
import { createSessionForUser } from "../../factories/session.factory.js";
import { createUser, TEST_PASSWORD } from "../../factories/user.factory.js";
import { createVerificationToken } from "../../factories/verification-token.factory.js";
import { cleanupTestData } from "../../helpers/db.js";
import { randomPhoneNumber } from "../../helpers/random.js";

vi.mock("../../../src/shared/mailer/index.js", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

const CONTEXT = { ip: "127.0.0.1", userAgent: "test-agent" };

function registerPayload(overrides: Record<string, unknown> = {}) {
  return {
    first_name: "Ahmed",
    last_name: "Aziz",
    phone_number: randomPhoneNumber(),
    email: `test-${nanoid(8)}@example.com`,
    password: TEST_PASSWORD,
    ...overrides,
  };
}

describe("auth.service", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("register", () => {
    it("creates a user, an authenticated session, and a verification token", async () => {
      const input = registerPayload();
      const result = await register(input, CONTEXT);

      expect(result.public_id).toMatch(/^usr_/);
      expect(result.email_verified).toBe(false);
      expect(result.sessionToken).toMatch(/^[0-9a-f]{64}$/);

      const user = await prisma.users.findUnique({ where: { email: input.email } });
      expect(user).not.toBeNull();
      expect(user!.status).toBe(user_status.ACTIVE);

      const session = await prisma.sessions.findFirst({
        where: { users_id: user!.id },
      });
      expect(session).not.toBeNull();
      expect(session!.refresh_token_hash).toBe(hashToken(result.sessionToken));

      const token = await prisma.verification_tokens.findFirst({
        where: { users_id: user!.id, purpose: verification_type.REGISTER_EMAIL },
      });
      expect(token).not.toBeNull();
      expect(token!.used_at).toBeNull();
      expect(token!.target).toBe(input.email);
    });

    it("throws ConflictError when the email is already registered", async () => {
      const email = `test-${nanoid(8)}@example.com`;
      await createUser({ email });

      await expect(register(registerPayload({ email }), CONTEXT)).rejects.toThrow(
        ConflictError,
      );
    });

    it("throws ConflictError when the phone number is already registered", async () => {
      const phone_number = randomPhoneNumber();
      await createUser({ phone_number });

      await expect(
        register(registerPayload({ phone_number }), CONTEXT),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("login", () => {
    it("authenticates valid credentials and creates a session", async () => {
      const user = await createUser();
      const result = await login(
        { email: user.email, password: TEST_PASSWORD },
        CONTEXT,
      );

      expect(result.public_id).toBe(user.public_id);
      expect(result.email_verified).toBe(false);
      expect(result.sessionToken).toMatch(/^[0-9a-f]{64}$/);

      const session = await prisma.sessions.findFirst({
        where: { users_id: user.id },
      });
      expect(session).not.toBeNull();
      expect(session!.refresh_token_hash).toBe(hashToken(result.sessionToken));
    });

    it("throws UnauthorizedError for a wrong password", async () => {
      const user = await createUser();
      await expect(
        login({ email: user.email, password: "WrongPassword123!" }, CONTEXT),
      ).rejects.toThrow(UnauthorizedError);
    });

    it("throws UnauthorizedError for an unknown email", async () => {
      await expect(
        login({ email: `test-${nanoid(8)}@example.com`, password: TEST_PASSWORD }, CONTEXT),
      ).rejects.toThrow(UnauthorizedError);
    });

    it("throws ForbiddenError for a suspended account", async () => {
      const user = await createUser({ status: user_status.SUSPENDED });
      await expect(
        login({ email: user.email, password: TEST_PASSWORD }, CONTEXT),
      ).rejects.toThrow(ForbiddenError);
    });

    it("throws ForbiddenError for a deleted account", async () => {
      const user = await createUser({
        status: user_status.DELETED,
        deleted_at: new Date(),
      });
      await expect(
        login({ email: user.email, password: TEST_PASSWORD }, CONTEXT),
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe("verifyEmail", () => {
    it("marks the email verified and invalidates the token", async () => {
      const user = await createUser();
      const rawToken = generateOpaqueToken();
      await createVerificationToken({
        usersId: user.id,
        rawToken,
        purpose: verification_type.REGISTER_EMAIL,
        target: user.email,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const result = await verifyEmail({ token: rawToken });
      expect(result.message).toBe("Email verified successfully.");

      const updated = await prisma.users.findUnique({ where: { id: user.id } });
      expect(updated!.email_verified_at).not.toBeNull();

      const token = await prisma.verification_tokens.findFirst({
        where: { users_id: user.id, purpose: verification_type.REGISTER_EMAIL },
      });
      expect(token!.used_at).not.toBeNull();
      expect(token!.verified_at).not.toBeNull();
    });

    it("throws NotFoundError for an unknown token", async () => {
      await expect(verifyEmail({ token: generateOpaqueToken() })).rejects.toThrow(
        NotFoundError,
      );
    });

    it("throws GoneError for an already used token", async () => {
      const user = await createUser();
      const rawToken = generateOpaqueToken();
      await createVerificationToken({
        usersId: user.id,
        rawToken,
        purpose: verification_type.REGISTER_EMAIL,
        target: user.email,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: new Date(),
        verifiedAt: new Date(),
      });

      await expect(verifyEmail({ token: rawToken })).rejects.toThrow(GoneError);
    });

    it("throws GoneError for an expired token", async () => {
      const user = await createUser();
      const rawToken = generateOpaqueToken();
      await createVerificationToken({
        usersId: user.id,
        rawToken,
        purpose: verification_type.REGISTER_EMAIL,
        target: user.email,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(verifyEmail({ token: rawToken })).rejects.toThrow(GoneError);
    });
  });

  describe("resendVerificationEmail", () => {
    it("issues a fresh token and invalidates previous unused tokens", async () => {
      const user = await createUser();
      const firstToken = await createVerificationToken({
        usersId: user.id,
        rawToken: generateOpaqueToken(),
        purpose: verification_type.REGISTER_EMAIL,
        target: user.email,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      });

      const result = await resendVerificationEmail(user);
      expect(result.message).toBe("Verification email sent.");

      const tokens = await prisma.verification_tokens.findMany({
        where: { users_id: user.id, purpose: verification_type.REGISTER_EMAIL },
      });
      expect(tokens).toHaveLength(2);

      const invalidated = await prisma.verification_tokens.findUnique({
        where: { id: firstToken.id },
      });
      expect(invalidated!.used_at).not.toBeNull();

      const fresh = tokens.find((token) => token.id !== firstToken.id);
      expect(fresh!.used_at).toBeNull();
    });

    it("throws ConflictError when the email is already verified", async () => {
      const user = await createUser({ email_verified_at: new Date() });
      await expect(resendVerificationEmail(user)).rejects.toThrow(ConflictError);
    });
  });

  describe("sessions", () => {
    it("lists active sessions with the current flag", async () => {
      const user = await createUser();
      const first = await createSessionForUser(user.id);
      const second = await createSessionForUser(user.id);

      const sessions = await listSessions(user.id, first.session.public_id);

      expect(sessions).toHaveLength(2);
      const current = sessions.find((session) => session.current);
      expect(current!.public_id).toBe(first.session.public_id);
      expect(
        sessions.find((session) => session.public_id === second.session.public_id)!
          .current,
      ).toBe(false);
    });

    it("revokes a session owned by the user", async () => {
      const user = await createUser();
      const { session } = await createSessionForUser(user.id);

      const revokedCurrent = await revokeSession(
        user.id,
        session.public_id,
        session.id,
      );

      expect(revokedCurrent).toBe(true);
      const stored = await prisma.sessions.findUnique({ where: { id: session.id } });
      expect(stored!.revoked_at).not.toBeNull();
    });

    it("throws NotFoundError when revoking a session that is not owned", async () => {
      const owner = await createUser();
      const other = await createUser();
      const { session } = await createSessionForUser(other.id);

      await expect(
        revokeSession(owner.id, session.public_id, owner.id),
      ).rejects.toThrow(NotFoundError);
    });

    it("revokes all sessions except the current one", async () => {
      const user = await createUser();
      const current = await createSessionForUser(user.id);
      const other = await createSessionForUser(user.id);

      await revokeAllOtherSessions(user.id, current.session.id);

      const sessions = await prisma.sessions.findMany({
        where: { users_id: user.id },
      });
      const currentStored = sessions.find(
        (session) => session.id === current.session.id,
      );
      const otherStored = sessions.find((session) => session.id === other.session.id);
      expect(currentStored!.revoked_at).toBeNull();
      expect(otherStored!.revoked_at).not.toBeNull();
    });
  });
});
