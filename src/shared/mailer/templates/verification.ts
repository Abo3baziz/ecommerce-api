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

export interface VerificationEmailInput {
  recipientName: string;
  verifyUrl: string;
  expiresInHours: number;
}

export function renderVerificationEmail({
  recipientName,
  verifyUrl,
  expiresInHours,
}: VerificationEmailInput): string {
  const safeName = escapeHtml(recipientName);
  const content = `
    ${emailEyebrow("Account verification")}
    ${emailHeading("Verify your email address")}
    ${emailText(`Hi ${safeName},`)}
    ${emailText(
      "Thanks for creating an account. Please confirm your email address to activate your account and get started.",
    )}
    ${emailButton(verifyUrl, "Verify email")}
    ${emailDivider()}
    ${emailSmallText("If the button doesn't work, copy and paste this link into your browser:")}
    ${emailTextLink(verifyUrl, verifyUrl)}
    ${emailSmallText(`This link will expire in ${expiresInHours} hours. If you didn't create an account, you can safely ignore this email.`, true)}
  `;

  return renderEmailLayout({
    preheader: "Confirm your email address to activate your account.",
    content,
  });
}
