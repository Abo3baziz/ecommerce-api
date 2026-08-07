import { randomInt } from "node:crypto";

export function generateOtp(length = 6): string {
  let otp = "";
  for (let i = 0; i < length; i += 1) {
    otp += randomInt(0, 10).toString();
  }
  return otp;
}
