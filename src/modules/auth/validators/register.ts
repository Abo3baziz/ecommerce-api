import { z } from "zod";
import { passwordField } from "../../../shared/validation/index.js";

const phoneNumberRegex = /^\+[1-9]\d{1,14}$/;

export const registerSchema = z.object({
  body: z.object({
    first_name: z.string().trim().min(1).max(100),
    last_name: z.string().trim().min(1).max(100),
    phone_number: z
      .string()
      .regex(phoneNumberRegex, "Phone number must be in E.164 format"),
    email: z.email(),
    password: passwordField,
  }),
});

export type RegisterBody = z.infer<typeof registerSchema.shape.body>;
