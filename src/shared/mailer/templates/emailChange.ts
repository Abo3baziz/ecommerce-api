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

export interface EmailChangeVerificationEmailInput {
  recipientName: string;
  verifyUrl: string;
  expiresInHours: number;
}

export function renderEmailChangeVerificationEmail({
  recipientName,
  verifyUrl,
  expiresInHours,
}: EmailChangeVerificationEmailInput): string {
  const safeName = escapeHtml(recipientName);
  const content = `
    ${emailEyebrow("Email change verification")}
    ${emailHeading("Confirm your new email")}
    ${emailText(`Hi ${safeName},`)}
    ${emailText(
      "We received a request to change the email address on your account. Click the button below to confirm the new address.",
    )}
    ${emailButton(verifyUrl, "Confirm email change")}
    ${emailDivider()}
    ${emailSmallText("If the button doesn't work, copy and paste this link into your browser:")}
    ${emailTextLink(verifyUrl, verifyUrl)}
    ${emailSmallText(`This link will expire in ${expiresInHours} hours. If you didn't request this change, you can safely ignore this email.`, true)}
  `;

  return renderEmailLayout({
    preheader: "Confirm your new email address to finish changing it.",
    content,
  });
}
