import { z } from "zod";

const ADMIN_SORT_FIELDS = ["name", "created_at", "last_login_at"] as const;

export const listAdminAccountsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
    activity: z.enum(["ACTIVE", "INACTIVE"]).optional(),
    sort: z
      .string()
      .refine(
        (value) => {
          const field = value.startsWith("-") ? value.slice(1) : value;
          return ADMIN_SORT_FIELDS.includes(
            field as (typeof ADMIN_SORT_FIELDS)[number],
          );
        },
        { message: "Invalid sort field" },
      )
      .default("-last_login_at"),
  }),
});

export type ListAdminAccountsQuery = z.infer<
  typeof listAdminAccountsSchema.shape.query
>;

export const adminAccountParamsSchema = z.object({
  params: z.object({
    admin_public_id: z.string().min(1),
  }),
});

export type AdminAccountParams = z.infer<
  typeof adminAccountParamsSchema.shape.params
>;
