import { env } from "../../config/env.js";
import { VERIFICATION_TOKEN_TTL_MS } from "../constants/index.js";
import { sendEmail } from "./index.js";
import { renderVerificationEmail } from "./templates/verification.js";

const HOURS_PER_MS = 60 * 60 * 1000;

export function buildVerificationUrl(token: string): string {
  return `${env.CORS_ORIGIN}/verify-email?token=${token}`;
}

export async function sendVerificationEmail(to: string, recipientName: string, token: string): Promise<void> {
  const verifyUrl = buildVerificationUrl(token);

  await sendEmail({
    to,
    subject: "Verify your email address",
    html: renderVerificationEmail({
      recipientName,
      verifyUrl,
      expiresInHours: VERIFICATION_TOKEN_TTL_MS / HOURS_PER_MS,
    }),
  });
}
