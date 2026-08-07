import { z } from "zod";

export const changeEmailSchema = z.object({
  body: z.object({
    new_email: z.email(),
    password: z.string().min(1),
  }),
});

export type ChangeEmailBody = z.infer<typeof changeEmailSchema.shape.body>;
