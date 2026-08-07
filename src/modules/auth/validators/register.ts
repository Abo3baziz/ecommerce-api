import { z } from "zod";

const phoneNumberRegex = /^\+[1-9]\d{1,14}$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

export const registerSchema = z.object({
  body: z.object({
    first_name: z.string().trim().min(1).max(100),
    last_name: z.string().trim().min(1).max(100),
    phone_number: z
      .string()
      .regex(phoneNumberRegex, "Phone number must be in E.164 format"),
    email: z.email(),
    password: z
      .string()
      .min(8)
      .regex(
        passwordRegex,
        "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number, and a special character",
      ),
  }),
});

export type RegisterBody = z.infer<typeof registerSchema.shape.body>;
