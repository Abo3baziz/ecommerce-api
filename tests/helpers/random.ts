import { customAlphabet } from "nanoid";

const phoneDigits = customAlphabet("0123456789", 10);

export function randomPhoneNumber(): string {
  return `+1${phoneDigits()}`;
}
