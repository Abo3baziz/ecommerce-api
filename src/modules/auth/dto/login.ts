import type { LoginBody } from "../validators/login.js";

export type LoginInput = LoginBody;

export interface LoginResult {
  public_id: string;
  email_verified: boolean;
}
