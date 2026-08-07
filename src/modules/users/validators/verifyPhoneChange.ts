import { z } from "zod";

export const verifyPhoneChangeSchema = z.object({
  body: z.object({
    otp: z.string().regex(/^\d{6}$/, "OTP must be a 6-digit code"),
  }),
});

export type VerifyPhoneChangeBody = z.infer<typeof verifyPhoneChangeSchema.shape.body>;
