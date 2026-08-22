import { env } from "../../config/env.js";
import { PASSWORD_RESET_TOKEN_TTL_MS } from "../constants/index.js";
import { sendEmail } from "./index.js";
import { renderPasswordResetEmail } from "./templates/passwordReset.js";

export function buildPasswordResetUrl(token: string): string {
  return `${env.CORS_ORIGIN}/reset-password?token=${token}`;
}

export async function sendPasswordResetEmail(
  to: string,
  recipientName: string,
  token: string,
  code: string,
): Promise<void> {
  const resetUrl = buildPasswordResetUrl(token);

  await sendEmail({
    to,
    subject: "Reset your password",
    html: renderPasswordResetEmail({
      recipientName,
      code,
      resetUrl,
      expiresInMinutes: Math.round(PASSWORD_RESET_TOKEN_TTL_MS / 60_000),
    }),
  });
}
