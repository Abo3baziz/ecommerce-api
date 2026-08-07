import { z } from "zod";

export const loginSchema = z.object({
  body: z.object({
    email: z.email(),
    password: z.string().min(1),
  }),
});

export type LoginBody = z.infer<typeof loginSchema.shape.body>;
