import { z } from "zod";

const AUDIT_SORT_FIELDS = ["created_at"] as const;

export const listAuditSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    actor: z.string().trim().max(50).optional(),
    action: z.string().trim().max(100).optional(),
    entity_type: z.string().trim().max(50).optional(),
    entity_public_id: z.string().trim().max(50).optional(),
    date_from: z.coerce.date().optional(),
    date_to: z.coerce.date().optional(),
    sort: z
      .string()
      .refine(
        (value) => {
          const field = value.startsWith("-") ? value.slice(1) : value;
          return AUDIT_SORT_FIELDS.includes(field as (typeof AUDIT_SORT_FIELDS)[number]);
        },
        { message: "Invalid sort field" },
      )
      .default("-created_at"),
  }),
});

export type ListAuditQuery = z.infer<typeof listAuditSchema.shape.query>;
