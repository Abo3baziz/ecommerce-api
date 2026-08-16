import { z } from "zod";
import { passwordField } from "../../../shared/validation/index.js";

export const changePasswordSchema = z.object({
  body: z.object({
    current_password: z.string().min(1),
    new_password: passwordField,
  }),
});

export type ChangePasswordBody = z.infer<typeof changePasswordSchema.shape.body>;
