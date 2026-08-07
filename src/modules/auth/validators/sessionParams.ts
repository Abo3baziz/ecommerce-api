import { z } from "zod";

export const sessionParamsSchema = z.object({
  params: z.object({
    session_public_id: z.string().min(1),
  }),
});

export type SessionParams = z.infer<typeof sessionParamsSchema.shape.params>;
