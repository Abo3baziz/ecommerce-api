import type { ChangePhoneBody } from "../validators/changePhone.js";
import type { VerifyPhoneChangeBody } from "../validators/verifyPhoneChange.js";

export type ChangePhoneInput = ChangePhoneBody;
export type VerifyPhoneChangeInput = VerifyPhoneChangeBody;

export interface ChangePhoneResult {
  message: string;
}

export interface VerifyPhoneChangeResult {
  message: string;
  phone_number: string;
}
