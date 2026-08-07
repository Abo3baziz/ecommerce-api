import { z } from "zod";

export const verifyEmailChangeSchema = z.object({
  body: z.object({
    token: z.string().trim().min(1),
  }),
});

export type VerifyEmailChangeBody = z.infer<typeof verifyEmailChangeSchema.shape.body>;
