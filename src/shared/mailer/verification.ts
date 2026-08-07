import { env } from "../../config/env.js";
import { sendEmail } from "./index.js";

export function buildVerificationUrl(token: string): string {
  return `${env.CORS_ORIGIN}/verify-email?token=${token}`;
}

export async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const verificationUrl = buildVerificationUrl(token);

  await sendEmail({
    to,
    subject: "Verify your email address",
    html: `
      <h1>Verify your email</h1>
      <p>Click the button below to verify your email address and activate your account.</p>
      <p><a href="${verificationUrl}">Verify email</a></p>
      <p>This link expires in 24 hours.</p>
    `,
  });
}
