import { z } from "zod";

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

export const changePasswordSchema = z.object({
  body: z.object({
    current_password: z.string().min(1),
    new_password: z
      .string()
      .min(8)
      .regex(
        passwordRegex,
        "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character",
      ),
  }),
});

export type ChangePasswordBody = z.infer<typeof changePasswordSchema.shape.body>;
