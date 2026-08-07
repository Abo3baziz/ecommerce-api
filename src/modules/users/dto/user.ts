import type { UpdateProfileBody } from "../validators/updateProfile.js";

export type UpdateProfileInput = UpdateProfileBody;

export interface UserResult {
  public_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  email_verified: boolean;
  created_at: Date;
  updated_at: Date;
}
