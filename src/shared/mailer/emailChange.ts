import { env } from "../../config/env.js";
import { VERIFICATION_TOKEN_TTL_MS } from "../constants/index.js";
import { sendEmail } from "./index.js";
import { renderEmailChangeVerificationEmail } from "./templates/emailChange.js";

const HOURS_PER_MS = 60 * 60 * 1000;

export function buildEmailChangeUrl(token: string): string {
  return `${env.CORS_ORIGIN}/verify-email-change?token=${token}`;
}

export async function sendEmailChangeVerificationEmail(
  to: string,
  recipientName: string,
  token: string,
): Promise<void> {
  const verifyUrl = buildEmailChangeUrl(token);

  await sendEmail({
    to,
    subject: "Confirm your new email address",
    html: renderEmailChangeVerificationEmail({
      recipientName,
      verifyUrl,
      expiresInHours: VERIFICATION_TOKEN_TTL_MS / HOURS_PER_MS,
    }),
  });
}
