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
  code: string;
  resetUrl: string;
  expiresInMinutes: number;
}

export function renderPasswordResetEmail({
  recipientName,
  code,
  resetUrl,
  expiresInMinutes,
}: PasswordResetEmailInput): string {
  const safeName = escapeHtml(recipientName);
  const safeCode = escapeHtml(code);
  const content = `
    ${emailEyebrow("Password reset")}
    ${emailHeading("Reset your password")}
    ${emailText(`Hi ${safeName},`)}
    ${emailText(
      "We received a request to reset the password for your account. Enter this verification code in the app to continue:",
    )}
    <div style="margin:24px 0;text-align:center;">
      <span style="display:inline-block;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:32px;font-weight:700;letter-spacing:8px;padding:14px 22px;border:1px solid #d4d4d8;border-radius:10px;background:#fafafa;color:#18181b;">${safeCode}</span>
    </div>
    ${emailSmallText("Prefer the one-click way? Use the button below instead — both the code and the link complete the same reset.", true)}
    ${emailButton(resetUrl, "Reset password via link")}
    ${emailDivider()}
    ${emailSmallText("If the button doesn't work, copy and paste this link into your browser:")}
    ${emailTextLink(resetUrl, resetUrl)}
    ${emailSmallText(`The code and this link will expire in ${expiresInMinutes} minutes. If you didn't request this reset, you can safely ignore this email.`, true)}
  `;

  return renderEmailLayout({
    preheader: "Choose a new password for your account.",
    content,
  });
}
