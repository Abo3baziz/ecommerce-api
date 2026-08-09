import { z } from "zod";
import {
  user_role,
  user_status,
} from "../../../generated/prisma/enums.js";
import {
  booleanQuery,
  paginationQuery,
  publicIdParam,
  searchQuery,
  sortQuery,
} from "./common.js";

const ADMIN_USER_SORT_FIELDS = ["name", "email", "created_at"] as const;

const userRoleField = z.enum([user_role.CUSTOMER, user_role.ADMIN]);
const userStatusField = z.enum([
  user_status.ACTIVE,
  user_status.SUSPENDED,
  user_status.DELETED,
]);

export const listAdminUsersSchema = z.object({
  query: z.object({
    ...paginationQuery,
    search: searchQuery,
    status: userStatusField.optional(),
    include_deleted: booleanQuery(false),
    sort: sortQuery(ADMIN_USER_SORT_FIELDS, "-created_at"),
  }),
});

export type ListAdminUsersQuery = z.infer<typeof listAdminUsersSchema.shape.query>;

export const adminUserParamsSchema = z.object({
  params: z.object({
    user_public_id: publicIdParam,
  }),
});

export type AdminUserParams = z.infer<typeof adminUserParamsSchema.shape.params>;

export const updateAdminUserSchema = z.object({
  params: z.object({
    user_public_id: publicIdParam,
  }),
  body: z.object({
    first_name: z.string().trim().min(1).max(100).optional(),
    last_name: z.string().trim().min(1).max(100).optional(),
    email: z.email().optional(),
    phone_number: z
      .string()
      .regex(/^\+[1-9]\d{1,14}$/, "Phone number must be in E.164 format")
      .optional(),
  }),
});

export type UpdateAdminUserBody = z.infer<typeof updateAdminUserSchema.shape.body>;

export const changeUserRoleSchema = z.object({
  params: z.object({
    user_public_id: publicIdParam,
  }),
  body: z.object({
    role: userRoleField,
  }),
});

export type ChangeUserRoleBody = z.infer<typeof changeUserRoleSchema.shape.body>;
