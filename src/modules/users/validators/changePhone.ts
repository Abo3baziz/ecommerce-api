import { z } from "zod";

const phoneNumberRegex = /^\+[1-9]\d{1,14}$/;

export const changePhoneSchema = z.object({
  body: z.object({
    new_phone_number: z
      .string()
      .regex(phoneNumberRegex, "Phone number must be in E.164 format"),
    password: z.string().min(1),
  }),
});

export type ChangePhoneBody = z.infer<typeof changePhoneSchema.shape.body>;
