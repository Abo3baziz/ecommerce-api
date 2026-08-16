import {
  emailButton,
  emailDivider,
  emailEyebrow,
  emailHeading,
  emailSmallText,
  emailText,
  emailTextLink,
  escapeHtml,
  renderEmailLayout,
} from "./index.js";

export interface PasswordResetEmailInput {
  recipientName: string;
  resetUrl: string;
  expiresInHours: number;
}

export function renderPasswordResetEmail({
  recipientName,
  resetUrl,
  expiresInHours,
}: PasswordResetEmailInput): string {
  const safeName = escapeHtml(recipientName);
  const content = `
    ${emailEyebrow("Password reset")}
    ${emailHeading("Reset your password")}
    ${emailText(`Hi ${safeName},`)}
    ${emailText(
      "We received a request to reset the password for your account. Click the button below to choose a new password.",
    )}
    ${emailButton(resetUrl, "Reset password")}
    ${emailDivider()}
    ${emailSmallText("If the button doesn't work, copy and paste this link into your browser:")}
    ${emailTextLink(resetUrl, resetUrl)}
    ${emailSmallText(`This link will expire in ${expiresInHours} hour(s). If you didn't request this reset, you can safely ignore this email.`, true)}
  `;

  return renderEmailLayout({
    preheader: "Choose a new password for your account.",
    content,
  });
}