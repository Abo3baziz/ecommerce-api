import type {
  RequestPasswordResetBody,
  VerifyOtpPasswordResetBody,
  VerifyPasswordResetBody,
} from "../validators/passwordReset.js";

export type RequestPasswordResetInput = RequestPasswordResetBody;

export type VerifyPasswordResetInput = VerifyPasswordResetBody;

export type VerifyOtpPasswordResetInput = VerifyOtpPasswordResetBody;

export interface RequestPasswordResetResult {
  message: string;
}

export interface VerifyOtpPasswordResetResult {
  reset_token: string;
}