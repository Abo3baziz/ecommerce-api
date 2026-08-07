import { z } from "zod";

export const verifyEmailSchema = z.object({
  body: z.object({
    token: z.string().trim().min(1),
  }),
});

export type VerifyEmailBody = z.infer<typeof verifyEmailSchema.shape.body>;
