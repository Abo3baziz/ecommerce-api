import { describe, it, expect, beforeEach, vi } from "vitest";
import { nanoid } from "nanoid";
import { changePassword } from "../../../src/modules/users/service/users.service.js";
import { verifyPasswordReset } from "../../../src/modules/auth/service/auth.service.js";
import {
  PASSWORD_RESET_TOKEN_TTL_MS,
  VERIFICATION_TOKEN_TTL_MS,
} from "../../../src/shared/constants/index.js";
import { GoneError } from "../../../src/shared/errors/GoneError.js";
import { UnauthorizedError } from "../../../src/shared/errors/UnauthorizedError.js";
import { verification_type } from "../../../src/generated/prisma/enums.js";
import { prisma } from "../../../src/config/database.js";
import { createUser, TEST_PASSWORD } from "../../factories/user.factory.js";
import { createSessionForUser } from "../../factories/session.factory.js";
import { createVerificationToken } from "../../factories/verification-token.factory.js";
import { cleanupTestData } from "../../helpers/db.js";

vi.mock("../../../src/shared/mailer/index.js", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../src/shared/mailer/emailChange.js", () => ({
  sendEmailChangeVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../src/shared/sms/index.js", () => ({
  sendSms: vi.fn().mockResolvedValue(undefined),
}));

function rawToken(): string {
  return `raw-${nanoid(32)}`;
}

async function seedToken(
  usersId: number,
  email: string,
  purpose: verification_type,
): Promise<string> {
  const token = rawToken();
  const expiresAt = new Date(
    Date.now() +
      (purpose === verification_type.PASSWORD_RESET
        ? PASSWORD_RESET_TOKEN_TTL_MS
        : VERIFICATION_TOKEN_TTL_MS),
  );

  await createVerificationToken({
    usersId,
    rawToken: token,
    purpose,
    target: email,
    expiresAt,
  });

  return token;
}

async function tokenRow(token: string) {
  const { hashToken } = await import(
    "../../../src/modules/auth/utils/tokens.js"
  );
  return prisma.verification_tokens.findFirst({
    where: { token_hash: hashToken(token) },
  });
}

describe("credential rotation invalidates pending tokens", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("changePassword", () => {
    it("invalidates pending password-reset and contact-change tokens in one transaction", async () => {
      const user = await createUser();
      const { session } = await createSessionForUser(user.id);

      const resetToken = await seedToken(
        user.id,
        user.email,
        verification_type.PASSWORD_RESET,
      );
      const emailToken = await seedToken(
        user.id,
        "test-new-email@example.com",
        verification_type.CHANGE_EMAIL,
      );
      const phoneToken = await seedToken(
        user.id,
        "+201000000000",
        verification_type.CHANGE_PHONE_NUMBER,
      );

      await changePassword(
        user,
        { current_password: TEST_PASSWORD, new_password: "NewStrongPassword456!" },
        session.id,
      );

      for (const token of [resetToken, emailToken, phoneToken]) {
        const row = await tokenRow(token);
        expect(row!.used_at).not.toBeNull();
      }
    });

    it("leaves a pending REGISTER_EMAIL token untouched", async () => {
      const user = await createUser();
      const { session } = await createSessionForUser(user.id);

      const registerToken = await seedToken(
        user.id,
        user.email,
        verification_type.REGISTER_EMAIL,
      );

      await changePassword(
        user,
        { current_password: TEST_PASSWORD, new_password: "NewStrongPassword456!" },
        session.id,
      );

      const row = await tokenRow(registerToken);
      expect(row!.used_at).toBeNull();
    });

    it("rejects an outstanding reset token with 410 after rotation and keeps the password unchanged", async () => {
      const user = await createUser();
      const { session } = await createSessionForUser(user.id);

      const resetToken = await seedToken(
        user.id,
        user.email,
        verification_type.PASSWORD_RESET,
      );

      const newPassword = "NewStrongPassword456!";
      await changePassword(
        user,
        { current_password: TEST_PASSWORD, new_password: newPassword },
        session.id,
      );

      await expect(
        verifyPasswordReset({ token: resetToken, new_password: "Hacked123!" }),
      ).rejects.toThrow(GoneError);

      const stored = await prisma.users.findUnique({ where: { id: user.id } });
      expect(stored).not.toBeNull();
    });

    it("does not touch any tokens when the current password is wrong", async () => {
      const user = await createUser();
      const { session } = await createSessionForUser(user.id);

      const resetToken = await seedToken(
        user.id,
        user.email,
        verification_type.PASSWORD_RESET,
      );

      await expect(
        changePassword(
          user,
          { current_password: "WrongPassword123!", new_password: "NewStrongPassword456!" },
          session.id,
        ),
      ).rejects.toThrow(UnauthorizedError);

      const row = await tokenRow(resetToken);
      expect(row!.used_at).toBeNull();
    });
  });

  describe("verifyPasswordReset", () => {
    it("also kills other unused credential tokens when a reset token is consumed", async () => {
      const user = await createUser();

      const olderResetToken = await seedToken(
        user.id,
        user.email,
        verification_type.PASSWORD_RESET,
      );
      const activeResetToken = await seedToken(
        user.id,
        user.email,
        verification_type.PASSWORD_RESET,
      );
      const emailToken = await seedToken(
        user.id,
        "test-new-email@example.com",
        verification_type.CHANGE_EMAIL,
      );

      await verifyPasswordReset({
        token: activeResetToken,
        new_password: "ResetStrongPassword789!",
      });

      const consumed = await tokenRow(activeResetToken);
      expect(consumed!.used_at).not.toBeNull();
      expect(consumed!.verified_at).not.toBeNull();

      for (const token of [olderResetToken, emailToken]) {
        const row = await tokenRow(token);
        expect(row!.used_at).not.toBeNull();
      }

      await expect(
        verifyPasswordReset({
          token: olderResetToken,
          new_password: "SecondTry123!",
        }),
      ).rejects.toThrow(GoneError);
    });
  });
});
