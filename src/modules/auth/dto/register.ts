import type { RegisterBody } from "../validators/register.js";

export type RegisterInput = RegisterBody;

export interface RegisterResult {
  public_id: string;
  email_verified: boolean;
}
