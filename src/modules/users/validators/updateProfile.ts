import { z } from "zod";

export const updateProfileSchema = z.object({
  body: z.object({
    first_name: z.string().trim().min(1).max(100).optional(),
    last_name: z.string().trim().min(1).max(100).optional(),
  }),
});

export type UpdateProfileBody = z.infer<typeof updateProfileSchema.shape.body>;
