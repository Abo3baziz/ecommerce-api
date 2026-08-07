import { compare, hash } from "bcrypt";
import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { ForbiddenError } from "../../../shared/errors/ForbiddenError.js";
import { GoneError } from "../../../shared/errors/GoneError.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import { UnauthorizedError } from "../../../shared/errors/UnauthorizedError.js";
import {
  PUBLIC_ID_PREFIXES,
  VERIFICATION_TOKEN_TTL_MS,
} from "../../../shared/constants/index.js";
import { SESSION_TTL_MS } from "../../../shared/constants/session.js";
import { generatePublicId } from "../../../shared/utils/index.js";
import { logger } from "../../../shared/logger/index.js";
import { prisma } from "../../../config/database.js";
import { sendVerificationEmail } from "../../../shared/mailer/verification.js";
import {
  user_role,
  user_status,
  verification_type,
} from "../../../generated/prisma/enums.js";
import { authRepository } from "../repository/auth.repository.js";
import { generateOpaqueToken, hashToken } from "../utils/tokens.js";
import { parseDeviceName } from "../utils/userAgent.js";
import type { users } from "../../../generated/prisma/client.js";
import type { RegisterInput, RegisterResult } from "../dto/register.js";
import type { LoginInput, LoginResult } from "../dto/login.js";
import type { VerifyEmailInput, VerifyEmailResult } from "../dto/verifyEmail.js";
import type { ListSessionsResult } from "../dto/session.js";
import type { RequestContext } from "../types/context.js";

const BCRYPT_ROUNDS = 12;

export async function register(
  input: RegisterInput,
  context: RequestContext,
): Promise<RegisterResult & { sessionToken: string }> {
  const existingEmail = await authRepository.findByEmail(input.email);
  if (existingEmail) {
    throw new ConflictError("Email is already registered");
  }

  const existingPhone = await authRepository.findByPhoneNumber(input.phone_number);
  if (existingPhone) {
    throw new ConflictError("Phone number is already registered");
  }

  const password_hash = await hash(input.password, BCRYPT_ROUNDS);

  const user = await authRepository.createUser({
    public_id: generatePublicId(PUBLIC_ID_PREFIXES.USER),
    email: input.email,
    phone_number: input.phone_number,
    first_name: input.first_name,
    last_name: input.last_name,
    password_hash,
    role: user_role.CUSTOMER,
    status: user_status.ACTIVE,
  });

  const sessionToken = await createSession(user.id, user.public_id, context);

  await issueVerificationToken(user.id, user.email, user.first_name);

  return {
    public_id: user.public_id,
    email_verified: user.email_verified_at !== null,
    sessionToken,
  };
}

export async function login(
  input: LoginInput,
  context: RequestContext,
): Promise<LoginResult & { sessionToken: string }> {
  const user = await authRepository.findUserByEmailWithCredentials(input.email);

  if (!user) {
    throw new UnauthorizedError("Invalid email or password");
  }

  const passwordValid = await compare(input.password, user.password_hash);

  if (!passwordValid) {
    throw new UnauthorizedError("Invalid email or password");
  }

  if (user.status !== user_status.ACTIVE || user.deleted_at !== null) {
    throw new ForbiddenError("Account is suspended or disabled");
  }

  const sessionToken = await createSession(user.id, user.public_id, context);

  return {
    public_id: user.public_id,
    email_verified: user.email_verified_at !== null,
    sessionToken,
  };
}

async function issueVerificationToken(
  users_id: number,
  email: string,
  recipientName: string,
): Promise<void> {
  const verificationToken = generateOpaqueToken();

  await authRepository.createVerificationToken({
    public_id: generatePublicId(PUBLIC_ID_PREFIXES.VERIFICATION),
    token_hash: hashToken(verificationToken),
    target: email,
    purpose: verification_type.REGISTER_EMAIL,
    expires_at: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
    users_id,
  });

  sendVerificationEmail(email, recipientName, verificationToken).catch((error) => {
    logger.error({ err: error, email }, "Failed to send verification email");
  });
}

export async function resendVerificationEmail(
  user: Pick<users, "id" | "email" | "first_name" | "email_verified_at">,
): Promise<VerifyEmailResult> {
  if (user.email_verified_at !== null) {
    throw new ConflictError("Email is already verified");
  }

  await authRepository.invalidateUnusedVerificationTokens(
    user.id,
    verification_type.REGISTER_EMAIL,
  );

  await issueVerificationToken(user.id, user.email, user.first_name);

  return { message: "Verification email sent." };
}

async function createSession(
  users_id: number,
  userPublicId: string,
  context: RequestContext,
): Promise<string> {
  const sessionToken = generateOpaqueToken();

  await authRepository.createSession({
    public_id: generatePublicId(PUBLIC_ID_PREFIXES.SESSION),
    refresh_token_hash: hashToken(sessionToken),
    expires_at: new Date(Date.now() + SESSION_TTL_MS),
    is_current: true,
    users_id,
    ip_address: context.ip ?? null,
    user_agent: context.userAgent ?? null,
    device_name: parseDeviceName(context.userAgent),
  });

  return sessionToken;
}

export async function listSessions(
  users_id: number,
  currentSessionPublicId: string,
): Promise<ListSessionsResult> {
  const sessions = await authRepository.findActiveSessionsByUser(users_id);

  return sessions.map((session) => ({
    public_id: session.public_id,
    current: session.public_id === currentSessionPublicId,
    device: session.device_name ?? parseDeviceName(session.user_agent),
    ip_address: session.ip_address,
    last_activity_at: session.last_activity_at,
    created_at: session.created_at,
  }));
}

export async function revokeSession(
  users_id: number,
  sessionPublicId: string,
  currentSessionId: number,
): Promise<boolean> {
  const session = await authRepository.findActiveSessionByPublicIdAndUser(
    sessionPublicId,
    users_id,
  );

  if (!session) {
    throw new NotFoundError("Session not found");
  }

  await authRepository.revokeSession(session.id);

  return session.id === currentSessionId;
}

export async function revokeAllOtherSessions(
  users_id: number,
  currentSessionId: number,
): Promise<void> {
  await authRepository.revokeAllSessionsExcept(users_id, currentSessionId);
}

export async function verifyEmail(input: VerifyEmailInput): Promise<VerifyEmailResult> {
  const tokenHash = hashToken(input.token);

  const verificationToken = await authRepository.findVerificationTokenByHash(
    tokenHash,
    verification_type.REGISTER_EMAIL,
  );

  if (!verificationToken) {
    throw new NotFoundError("Verification token not found");
  }

  if (verificationToken.used_at !== null || verificationToken.verified_at !== null) {
    throw new GoneError("Verification token has already been used");
  }

  if (verificationToken.expires_at.getTime() < Date.now()) {
    throw new GoneError("Verification token has expired");
  }

  await prisma.$transaction(async (tx) => {
    await authRepository.markEmailVerified(verificationToken.users_id, tx);
    await authRepository.invalidateVerificationToken(verificationToken.id, tx);
  });

  return { message: "Email verified successfully." };
}
