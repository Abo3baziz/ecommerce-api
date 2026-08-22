import { z } from "zod";

export const publicIdParam = z.string().min(1);
