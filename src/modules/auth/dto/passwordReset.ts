import type {
  RequestPasswordResetBody,
  VerifyPasswordResetBody,
} from "../validators/passwordReset.js";

export type RequestPasswordResetInput = RequestPasswordResetBody;

export type VerifyPasswordResetInput = VerifyPasswordResetBody;

export interface RequestPasswordResetResult {
  message: string;
}