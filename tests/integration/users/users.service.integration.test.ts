import { describe, it, expect, beforeEach, vi } from "vitest";
import { compare } from "bcrypt";
import { nanoid } from "nanoid";
import {
  changeEmail,
  changePassword,
  changePhone,
  deleteAccount,
  getCurrentUser,
  updateProfile,
  verifyEmailChange,
  verifyPhoneChange,
} from "../../../src/modules/users/service/users.service.js";
import { generateOpaqueToken } from "../../../src/modules/auth/utils/tokens.js";
import { prisma } from "../../../src/config/database.js";
import { BadRequestError } from "../../../src/shared/errors/BadRequestError.js";
import { ConflictError } from "../../../src/shared/errors/ConflictError.js";
import { GoneError } from "../../../src/shared/errors/GoneError.js";
import { NotFoundError } from "../../../src/shared/errors/NotFoundError.js";
import { UnauthorizedError } from "../../../src/shared/errors/UnauthorizedError.js";
import { sendEmailChangeVerificationEmail } from "../../../src/shared/mailer/emailChange.js";
import { sendSms } from "../../../src/shared/sms/index.js";
import {
  user_status,
  verification_type,
} from "../../../src/generated/prisma/enums.js";
import { createSessionForUser } from "../../factories/session.factory.js";
import { createUser, TEST_PASSWORD } from "../../factories/user.factory.js";
import { createVerificationToken } from "../../factories/verification-token.factory.js";
import { cleanupTestData } from "../../helpers/db.js";
import { randomPhoneNumber } from "../../helpers/random.js";

vi.mock("../../../src/shared/mailer/emailChange.js", () => ({
  sendEmailChangeVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../src/shared/sms/index.js", () => ({
  sendSms: vi.fn().mockResolvedValue(undefined),
}));

const FUTURE = () => new Date(Date.now() + 60 * 60 * 1000);
const PAST = () => new Date(Date.now() - 1000);

function newEmail(): string {
  return `test-${nanoid(8)}@example.com`;
}

function newPhone(): string {
  return randomPhoneNumber();
}

function capturedOtp(): string {
  const sms = vi.mocked(sendSms).mock.calls.at(-1)![0];
  const match = sms.message.match(/\d{6}/);
  expect(match).not.toBeNull();
  return match![0];
}

describe("users.service", () => {
  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
  });

  describe("getCurrentUser", () => {
    it("returns the current user profile without sensitive fields", async () => {
      const user = await createUser();

      const result = await getCurrentUser(user.id);

      expect(result.public_id).toBe(user.public_id);
      expect(result.email).toBe(user.email);
      expect(result.first_name).toBe(user.first_name);
      expect(result.last_name).toBe(user.last_name);
      expect(result.phone_number).toBe(user.phone_number);
      expect(result.email_verified).toBe(false);
      expect(result).not.toHaveProperty("password_hash");
    });

    it("throws NotFoundError for a non-existent user", async () => {
      await expect(getCurrentUser(999_999_999)).rejects.toThrow(NotFoundError);
    });
  });

  describe("updateProfile", () => {
    it("updates the first and last name", async () => {
      const user = await createUser();

      const result = await updateProfile(user.id, {
        first_name: "Omar",
        last_name: "Hassan",
      });

      expect(result.first_name).toBe("Omar");
      expect(result.last_name).toBe("Hassan");

      const stored = await prisma.users.findUnique({ where: { id: user.id } });
      expect(stored!.first_name).toBe("Omar");
      expect(stored!.last_name).toBe("Hassan");
    });

    it("throws NotFoundError for a non-existent user", async () => {
      await expect(
        updateProfile(999_999_999, { first_name: "Omar" }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("deleteAccount", () => {
    it("soft-deletes the account and revokes all sessions", async () => {
      const user = await createUser();
      const { session } = await createSessionForUser(user.id);

      await deleteAccount(user, TEST_PASSWORD);

      const stored = await prisma.users.findUnique({ where: { id: user.id } });
      expect(stored!.status).toBe(user_status.DELETED);
      expect(stored!.deleted_at).not.toBeNull();

      const storedSession = await prisma.sessions.findUnique({
        where: { id: session.id },
      });
      expect(storedSession!.revoked_at).not.toBeNull();
    });

    it("throws UnauthorizedError when the password is incorrect", async () => {
      const user = await createUser();

      await expect(
        deleteAccount(user, "WrongPassword123!"),
      ).rejects.toThrow(UnauthorizedError);

      const stored = await prisma.users.findUnique({ where: { id: user.id } });
      expect(stored!.status).toBe(user_status.ACTIVE);
      expect(stored!.deleted_at).toBeNull();
    });
  });

  describe("changePassword", () => {
    it("updates the password and revokes other sessions but keeps the current one", async () => {
      const user = await createUser();
      const current = await createSessionForUser(user.id);
      const other = await createSessionForUser(user.id);
      const newPassword = "NewStrongPassword456!";

      await changePassword(
        user,
        { current_password: TEST_PASSWORD, new_password: newPassword },
        current.session.id,
      );

      const stored = await prisma.users.findUnique({ where: { id: user.id } });
      expect(await compare(newPassword, stored!.password_hash)).toBe(true);
      expect(await compare(TEST_PASSWORD, stored!.password_hash)).toBe(false);

      const currentStored = await prisma.sessions.findUnique({
        where: { id: current.session.id },
      });
      const otherStored = await prisma.sessions.findUnique({
        where: { id: other.session.id },
      });
      expect(currentStored!.revoked_at).toBeNull();
      expect(otherStored!.revoked_at).not.toBeNull();
    });

    it("throws UnauthorizedError when the current password is incorrect", async () => {
      const user = await createUser();
      const { session } = await createSessionForUser(user.id);

      await expect(
        changePassword(
          user,
          { current_password: "WrongPassword123!", new_password: "NewStrongPassword456!" },
          session.id,
        ),
      ).rejects.toThrow(UnauthorizedError);
    });

    it("throws BadRequestError when the new password equals the current one", async () => {
      const user = await createUser();
      const { session } = await createSessionForUser(user.id);

      await expect(
        changePassword(
          user,
          { current_password: TEST_PASSWORD, new_password: TEST_PASSWORD },
          session.id,
        ),
      ).rejects.toThrow(BadRequestError);
    });
  });

  describe("changeEmail", () => {
    it("issues a verification token and sends the verification email", async () => {
      const user = await createUser();
      const new_email = newEmail();

      const result = await changeEmail(user, {
        password: TEST_PASSWORD,
        new_email,
      });

      expect(result.message).toBe("Verification email sent.");
      expect(sendEmailChangeVerificationEmail).toHaveBeenCalledWith(
        new_email,
        user.first_name,
        expect.stringMatching(/^[0-9a-f]{64}$/),
      );

      const token = await prisma.verification_tokens.findFirst({
        where: { users_id: user.id, purpose: verification_type.CHANGE_EMAIL },
      });
      expect(token).not.toBeNull();
      expect(token!.target).toBe(new_email);
      expect(token!.used_at).toBeNull();

      const stored = await prisma.users.findUnique({ where: { id: user.id } });
      expect(stored!.email).toBe(user.email);
    });

    it("invalidates previous unused tokens on a fresh request", async () => {
      const user = await createUser();

      await changeEmail(user, { password: TEST_PASSWORD, new_email: newEmail() });
      const first = await prisma.verification_tokens.findFirst({
        where: { users_id: user.id, purpose: verification_type.CHANGE_EMAIL },
      });

      await changeEmail(user, { password: TEST_PASSWORD, new_email: newEmail() });

      const tokens = await prisma.verification_tokens.findMany({
        where: { users_id: user.id, purpose: verification_type.CHANGE_EMAIL },
      });
      expect(tokens).toHaveLength(2);

      const firstStored = await prisma.verification_tokens.findUnique({
        where: { id: first!.id },
      });
      expect(firstStored!.used_at).not.toBeNull();
    });

    it("throws UnauthorizedError when the password is incorrect", async () => {
      const user = await createUser();

      await expect(
        changeEmail(user, {
          password: "WrongPassword123!",
          new_email: newEmail(),
        }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it("throws BadRequestError when the new email equals the current one", async () => {
      const user = await createUser();

      await expect(
        changeEmail(user, { password: TEST_PASSWORD, new_email: user.email }),
      ).rejects.toThrow(BadRequestError);
    });

    it("throws ConflictError when the email is already in use", async () => {
      const user = await createUser();
      const other = await createUser();

      await expect(
        changeEmail(user, { password: TEST_PASSWORD, new_email: other.email }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("verifyEmailChange", () => {
    it("updates the email, marks it verified, and invalidates the token", async () => {
      const user = await createUser();
      const new_email = newEmail();
      await changeEmail(user, { password: TEST_PASSWORD, new_email });

      const token = vi.mocked(sendEmailChangeVerificationEmail).mock.calls.at(
        -1,
      )![2];

      const result = await verifyEmailChange(user, { token });

      expect(result.email).toBe(new_email);
      expect(result.email_verified).toBe(true);

      const stored = await prisma.users.findUnique({ where: { id: user.id } });
      expect(stored!.email).toBe(new_email);
      expect(stored!.email_verified_at).not.toBeNull();

      const tokenStored = await prisma.verification_tokens.findFirst({
        where: { users_id: user.id, purpose: verification_type.CHANGE_EMAIL },
      });
      expect(tokenStored!.used_at).not.toBeNull();
    });

    it("throws NotFoundError for an unknown token", async () => {
      const user = await createUser();

      await expect(
        verifyEmailChange(user, { token: generateOpaqueToken() }),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for a token owned by another user", async () => {
      const user = await createUser();
      const other = await createUser();
      const rawToken = generateOpaqueToken();
      await createVerificationToken({
        usersId: other.id,
        rawToken,
        purpose: verification_type.CHANGE_EMAIL,
        target: newEmail(),
        expiresAt: FUTURE(),
      });

      await expect(verifyEmailChange(user, { token: rawToken })).rejects.toThrow(
        NotFoundError,
      );
    });

    it("throws GoneError for an already used token", async () => {
      const user = await createUser();
      const rawToken = generateOpaqueToken();
      await createVerificationToken({
        usersId: user.id,
        rawToken,
        purpose: verification_type.CHANGE_EMAIL,
        target: newEmail(),
        expiresAt: FUTURE(),
        usedAt: new Date(),
        verifiedAt: new Date(),
      });

      await expect(verifyEmailChange(user, { token: rawToken })).rejects.toThrow(
        GoneError,
      );
    });

    it("throws GoneError for an expired token", async () => {
      const user = await createUser();
      const rawToken = generateOpaqueToken();
      await createVerificationToken({
        usersId: user.id,
        rawToken,
        purpose: verification_type.CHANGE_EMAIL,
        target: newEmail(),
        expiresAt: PAST(),
      });

      await expect(verifyEmailChange(user, { token: rawToken })).rejects.toThrow(
        GoneError,
      );
    });

    it("throws ConflictError when the new email is taken by another user", async () => {
      const user = await createUser();
      const other = await createUser();
      const rawToken = generateOpaqueToken();
      await createVerificationToken({
        usersId: user.id,
        rawToken,
        purpose: verification_type.CHANGE_EMAIL,
        target: other.email,
        expiresAt: FUTURE(),
      });

      await expect(verifyEmailChange(user, { token: rawToken })).rejects.toThrow(
        ConflictError,
      );
    });
  });

  describe("changePhone", () => {
    it("issues an OTP token and sends the SMS", async () => {
      const user = await createUser();
      const new_phone_number = newPhone();

      const result = await changePhone(user, {
        password: TEST_PASSWORD,
        new_phone_number,
      });

      expect(result.message).toBe("Verification code sent.");
      expect(sendSms).toHaveBeenCalledWith({
        to: new_phone_number,
        message: expect.stringContaining("verification code"),
      });

      const token = await prisma.verification_tokens.findFirst({
        where: {
          users_id: user.id,
          purpose: verification_type.CHANGE_PHONE_NUMBER,
        },
      });
      expect(token).not.toBeNull();
      expect(token!.target).toBe(new_phone_number);
      expect(token!.used_at).toBeNull();
    });

    it("throws UnauthorizedError when the password is incorrect", async () => {
      const user = await createUser();

      await expect(
        changePhone(user, {
          password: "WrongPassword123!",
          new_phone_number: newPhone(),
        }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it("throws BadRequestError when the new phone number equals the current one", async () => {
      const user = await createUser();

      await expect(
        changePhone(user, {
          password: TEST_PASSWORD,
          new_phone_number: user.phone_number,
        }),
      ).rejects.toThrow(BadRequestError);
    });

    it("throws ConflictError when the phone number is already in use", async () => {
      const user = await createUser();
      const other = await createUser();

      await expect(
        changePhone(user, {
          password: TEST_PASSWORD,
          new_phone_number: other.phone_number,
        }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("verifyPhoneChange", () => {
    it("updates the phone number and invalidates the code", async () => {
      const user = await createUser();
      const new_phone_number = newPhone();
      await changePhone(user, { password: TEST_PASSWORD, new_phone_number });

      const result = await verifyPhoneChange(user, { otp: capturedOtp() });

      expect(result.phone_number).toBe(new_phone_number);

      const stored = await prisma.users.findUnique({ where: { id: user.id } });
      expect(stored!.phone_number).toBe(new_phone_number);
      expect(stored!.phone_verified_at).not.toBeNull();

      const tokenStored = await prisma.verification_tokens.findFirst({
        where: {
          users_id: user.id,
          purpose: verification_type.CHANGE_PHONE_NUMBER,
        },
      });
      expect(tokenStored!.used_at).not.toBeNull();
    });

    it("throws NotFoundError when there is no pending request", async () => {
      const user = await createUser();

      await expect(verifyPhoneChange(user, { otp: "123456" })).rejects.toThrow(
        NotFoundError,
      );
    });

    it("throws BadRequestError for an invalid code", async () => {
      const user = await createUser();
      const new_phone_number = newPhone();
      await changePhone(user, { password: TEST_PASSWORD, new_phone_number });

      const realOtp = capturedOtp();
      const wrongOtp = realOtp === "000000" ? "000001" : "000000";

      await expect(verifyPhoneChange(user, { otp: wrongOtp })).rejects.toThrow(
        BadRequestError,
      );
    });

    it("throws NotFoundError for an expired pending request", async () => {
      const user = await createUser();
      await createVerificationToken({
        usersId: user.id,
        rawToken: "123456",
        purpose: verification_type.CHANGE_PHONE_NUMBER,
        target: newPhone(),
        expiresAt: PAST(),
      });

      await expect(verifyPhoneChange(user, { otp: "123456" })).rejects.toThrow(
        NotFoundError,
      );
    });

    it("throws GoneError for an already used code", async () => {
      const user = await createUser();
      const new_phone_number = newPhone();
      await changePhone(user, { password: TEST_PASSWORD, new_phone_number });
      await createVerificationToken({
        usersId: user.id,
        rawToken: "654321",
        purpose: verification_type.CHANGE_PHONE_NUMBER,
        target: newPhone(),
        expiresAt: FUTURE(),
        usedAt: new Date(),
        verifiedAt: new Date(),
      });

      await expect(verifyPhoneChange(user, { otp: "654321" })).rejects.toThrow(
        GoneError,
      );
    });

    it("throws ConflictError when the new phone is taken by another user", async () => {
      const user = await createUser();
      const other = await createUser();
      await createVerificationToken({
        usersId: user.id,
        rawToken: "654321",
        purpose: verification_type.CHANGE_PHONE_NUMBER,
        target: other.phone_number,
        expiresAt: FUTURE(),
      });

      await expect(verifyPhoneChange(user, { otp: "654321" })).rejects.toThrow(
        ConflictError,
      );
    });
  });
});
