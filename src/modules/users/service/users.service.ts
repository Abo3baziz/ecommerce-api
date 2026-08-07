import { compare, hash } from "bcrypt";
import { BadRequestError } from "../../../shared/errors/BadRequestError.js";
import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { GoneError } from "../../../shared/errors/GoneError.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import { UnauthorizedError } from "../../../shared/errors/UnauthorizedError.js";
import {
  PHONE_OTP_TTL_MS,
  PUBLIC_ID_PREFIXES,
  VERIFICATION_TOKEN_TTL_MS,
} from "../../../shared/constants/index.js";
import { generatePublicId } from "../../../shared/utils/index.js";
import { logger } from "../../../shared/logger/index.js";
import { prisma } from "../../../config/database.js";
import { sendEmailChangeVerificationEmail } from "../../../shared/mailer/emailChange.js";
import { sendSms } from "../../../shared/sms/index.js";
import { verification_type } from "../../../generated/prisma/enums.js";
import type { users } from "../../../generated/prisma/client.js";
import { authRepository } from "../../auth/repository/auth.repository.js";
import { generateOpaqueToken, hashToken } from "../../auth/utils/tokens.js";
import { usersRepository } from "../repository/users.repository.js";
import type { UserRow } from "../repository/users.repository.js";
import { generateOtp } from "../utils/otp.js";
import type { UpdateProfileInput, UserResult } from "../dto/user.js";
import type { ChangePasswordBody } from "../validators/changePassword.js";
import type {
  ChangeEmailInput,
  ChangeEmailResult,
  VerifyEmailChangeInput,
  VerifyEmailChangeResult,
} from "../dto/changeEmail.js";
import type {
  ChangePhoneInput,
  ChangePhoneResult,
  VerifyPhoneChangeInput,
  VerifyPhoneChangeResult,
} from "../dto/changePhone.js";

const BCRYPT_ROUNDS = 12;

function toUserResult(user: UserRow): UserResult {
  return {
    public_id: user.public_id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    phone_number: user.phone_number,
    email_verified: user.email_verified_at !== null,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}

export async function getCurrentUser(id: number): Promise<UserResult> {
  const user = await usersRepository.findById(id);

  if (!user) {
    throw new NotFoundError("User not found");
  }

  return toUserResult(user);
}

export async function updateProfile(
  id: number,
  input: UpdateProfileInput,
): Promise<UserResult> {
  const user = await usersRepository.findById(id);

  if (!user) {
    throw new NotFoundError("User not found");
  }

  const updated = await usersRepository.updateProfile(id, input);

  return toUserResult(updated);
}

export async function deleteAccount(
  user: Pick<users, "id" | "password_hash">,
  password: string,
): Promise<void> {
  const passwordValid = await compare(password, user.password_hash);

  if (!passwordValid) {
    throw new UnauthorizedError("Invalid password");
  }

  await prisma.$transaction(async (tx) => {
    await usersRepository.softDeleteAccount(user.id, tx);
    await usersRepository.revokeAllSessions(user.id, tx);
  });
}

export async function changePassword(
  user: Pick<users, "id" | "password_hash">,
  input: ChangePasswordBody,
  currentSessionId: number,
): Promise<void> {
  const currentValid = await compare(input.current_password, user.password_hash);

  if (!currentValid) {
    throw new UnauthorizedError("The current password is incorrect.");
  }

  if (input.new_password === input.current_password) {
    throw new BadRequestError(
      "The new password must be different from the current password.",
    );
  }

  const password_hash = await hash(input.new_password, BCRYPT_ROUNDS);

  await usersRepository.updatePassword(user.id, password_hash);
  await usersRepository.revokeAllOtherSessions(user.id, currentSessionId);
}

export async function changeEmail(
  user: Pick<users, "id" | "email" | "first_name" | "password_hash">,
  input: ChangeEmailInput,
): Promise<ChangeEmailResult> {
  const passwordValid = await compare(input.password, user.password_hash);

  if (!passwordValid) {
    throw new UnauthorizedError("Invalid password");
  }

  if (input.new_email === user.email) {
    throw new BadRequestError(
      "The new email must be different from the current email.",
    );
  }

  const existing = await usersRepository.findByEmail(input.new_email);

  if (existing) {
    throw new ConflictError("Email is already in use");
  }

  const verificationToken = generateOpaqueToken();

  await createChangeToken(
    user.id,
    input.new_email,
    verification_type.CHANGE_EMAIL,
    new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
    verificationToken,
  );

  sendEmailChangeVerificationEmail(
    input.new_email,
    user.first_name,
    verificationToken,
  ).catch((error) => {
    logger.error(
      { err: error, email: input.new_email },
      "Failed to send email change verification email",
    );
  });

  return { message: "Verification email sent." };
}

export async function verifyEmailChange(
  user: Pick<users, "id">,
  input: VerifyEmailChangeInput,
): Promise<VerifyEmailChangeResult> {
  const tokenHash = hashToken(input.token);

  const token = await authRepository.findVerificationTokenByHash(
    tokenHash,
    verification_type.CHANGE_EMAIL,
  );

  if (!token || token.users_id !== user.id) {
    throw new NotFoundError("Verification token not found");
  }

  if (token.used_at !== null || token.verified_at !== null) {
    throw new GoneError("Verification token has already been used");
  }

  if (token.expires_at.getTime() < Date.now()) {
    throw new GoneError("Verification token has expired");
  }

  const newEmail = token.target;

  const existing = await usersRepository.findByEmail(newEmail);

  if (existing && existing.id !== user.id) {
    throw new ConflictError("Email is already in use");
  }

  await prisma.$transaction(async (tx) => {
    await usersRepository.updateEmail(user.id, newEmail, tx);
    await authRepository.invalidateVerificationToken(token.id, tx);
  });

  return {
    message: "Email updated successfully.",
    email: newEmail,
    email_verified: true,
  };
}

export async function changePhone(
  user: Pick<users, "id" | "phone_number" | "password_hash">,
  input: ChangePhoneInput,
): Promise<ChangePhoneResult> {
  const passwordValid = await compare(input.password, user.password_hash);

  if (!passwordValid) {
    throw new UnauthorizedError("Invalid password");
  }

  if (input.new_phone_number === user.phone_number) {
    throw new BadRequestError(
      "The new phone number must be different from the current phone number.",
    );
  }

  const existing = await usersRepository.findByPhoneNumber(input.new_phone_number);

  if (existing) {
    throw new ConflictError("Phone number is already in use");
  }

  const otp = generateOtp();

  await createChangeToken(
    user.id,
    input.new_phone_number,
    verification_type.CHANGE_PHONE_NUMBER,
    new Date(Date.now() + PHONE_OTP_TTL_MS),
    otp,
  );

  sendSms({
    to: input.new_phone_number,
    message: `Your verification code is ${otp}. It expires in 10 minutes.`,
  }).catch((error) => {
    logger.error(
      { err: error, phone: input.new_phone_number },
      "Failed to send SMS verification code",
    );
  });

  return { message: "Verification code sent." };
}

export async function verifyPhoneChange(
  user: Pick<users, "id">,
  input: VerifyPhoneChangeInput,
): Promise<VerifyPhoneChangeResult> {
  const pending = await usersRepository.hasPendingVerificationToken(
    user.id,
    verification_type.CHANGE_PHONE_NUMBER,
  );

  if (!pending) {
    throw new NotFoundError("Verification request not found");
  }

  const tokenHash = hashToken(input.otp);

  const token = await authRepository.findVerificationTokenByHash(
    tokenHash,
    verification_type.CHANGE_PHONE_NUMBER,
  );

  if (!token || token.users_id !== user.id) {
    throw new BadRequestError("Invalid verification code");
  }

  if (token.used_at !== null || token.verified_at !== null) {
    throw new GoneError("Verification code has already been used");
  }

  if (token.expires_at.getTime() < Date.now()) {
    throw new GoneError("Verification code has expired");
  }

  const newPhoneNumber = token.target;

  const existing = await usersRepository.findByPhoneNumber(newPhoneNumber);

  if (existing && existing.id !== user.id) {
    throw new ConflictError("Phone number is already in use");
  }

  await prisma.$transaction(async (tx) => {
    await usersRepository.updatePhone(user.id, newPhoneNumber, tx);
    await authRepository.invalidateVerificationToken(token.id, tx);
  });

  return {
    message: "Phone number updated successfully.",
    phone_number: newPhoneNumber,
  };
}

async function createChangeToken(
  users_id: number,
  target: string,
  purpose: verification_type,
  expires_at: Date,
  rawToken: string,
): Promise<void> {
  await authRepository.invalidateUnusedVerificationTokens(users_id, purpose);

  await authRepository.createVerificationToken({
    public_id: generatePublicId(PUBLIC_ID_PREFIXES.VERIFICATION),
    token_hash: hashToken(rawToken),
    target,
    purpose,
    expires_at,
    users_id,
  });
}
