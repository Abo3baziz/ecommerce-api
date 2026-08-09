import { user_role, user_status } from "../../../generated/prisma/enums.js";
import type {
  ChangeUserRoleBody,
  UpdateAdminUserBody,
} from "../validators/admin.js";

export type UpdateAdminUserInput = UpdateAdminUserBody;

export type ChangeUserRoleInput = ChangeUserRoleBody;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface AdminUserResult {
  public_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  role: user_role;
  status: user_status;
  email_verified: boolean;
  phone_verified: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ListAdminUsersResult {
  users: AdminUserResult[];
  pagination: PaginationMeta;
}

export interface RoleChangeResult {
  public_id: string;
  role: user_role;
}
