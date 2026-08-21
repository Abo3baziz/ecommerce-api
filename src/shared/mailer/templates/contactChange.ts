import {
  emailDivider,
  emailEyebrow,
  emailHeading,
  emailSmallText,
  emailText,
  escapeHtml,
  renderEmailLayout,
} from "./index.js";

export interface ContactDetailsChangedEmailInput {
  recipientName: string;
  changedFields: string[];
}

function formatField(field: string): string {
  switch (field) {
    case "email":
      return "email address";
    case "phone_number":
      return "phone number";
    default:
      return field;
  }
}

export function renderContactDetailsChangedEmail(
  input: ContactDetailsChangedEmailInput,
): string {
  const safeName = escapeHtml(input.recipientName);
  const changed = input.changedFields
    .map((field) => escapeHtml(formatField(field)))
    .join(" and ");

  return renderEmailLayout({
    content: `
      ${emailEyebrow("Account security")}
      ${emailHeading("Your account details were updated")}
      ${emailText(`Hi ${safeName},`)}
      ${emailText(
        `An administrator updated the ${changed} on your account.`,
      )}
      ${emailText(
        "If you did not expect this change, please contact support immediately.",
      )}
      ${emailDivider()}
      ${emailSmallText(
        "Changed contact details start unverified and may require re-verification.",
        true,
      )}
    `,
  });
}
