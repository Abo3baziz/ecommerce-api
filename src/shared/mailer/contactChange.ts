import { sendEmail } from "./index.js";
import { renderContactDetailsChangedEmail } from "./templates/contactChange.js";

export async function sendContactDetailsChangedEmail(
  to: string,
  recipientName: string,
  changedFields: string[],
): Promise<void> {
  await sendEmail({
    to,
    subject: "Your account contact details were updated",
    html: renderContactDetailsChangedEmail({ recipientName, changedFields }),
  });
}
