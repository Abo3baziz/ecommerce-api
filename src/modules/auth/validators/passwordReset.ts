import { z } from "zod";
import { passwordField } from "../../../shared/validation/index.js";

export const requestPasswordResetSchema = z.object({
  body: z.object({
    email: z.email(),
  }),
});

export const verifyPasswordResetSchema = z.object({
  body: z.object({
    token: z.string().trim().min(1),
    new_password: passwordField,
  }),
});

export const verifyOtpPasswordResetSchema = z.object({
  body: z.object({
    email: z.email(),
    code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
  }),
});

export type RequestPasswordResetBody = z.infer<
  typeof requestPasswordResetSchema.shape.body
>;

export type VerifyPasswordResetBody = z.infer<
  typeof verifyPasswordResetSchema.shape.body
>;

export type VerifyOtpPasswordResetBody = z.infer<
  typeof verifyOtpPasswordResetSchema.shape.body
>;