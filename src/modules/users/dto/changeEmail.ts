import type { ChangeEmailBody } from "../validators/changeEmail.js";
import type { VerifyEmailChangeBody } from "../validators/verifyEmailChange.js";

export type ChangeEmailInput = ChangeEmailBody;
export type VerifyEmailChangeInput = VerifyEmailChangeBody;

export interface ChangeEmailResult {
  message: string;
}

export interface VerifyEmailChangeResult {
  message: string;
  email: string;
  email_verified: boolean;
}
