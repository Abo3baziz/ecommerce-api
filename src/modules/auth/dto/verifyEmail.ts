import type { VerifyEmailBody } from "../validators/verifyEmail.js";

export type VerifyEmailInput = VerifyEmailBody;

export interface VerifyEmailResult {
  message: string;
}
