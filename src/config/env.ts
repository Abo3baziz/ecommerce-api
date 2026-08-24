import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(16),
  CORS_ORIGIN: z.string().url(),
  RESEND_API_KEY: z.string().min(1),
  RESEND_FROM_EMAIL: z.string().default("onboarding@resend.dev"),
  IMAGEKIT_PUBLIC_KEY: z.string().min(1),
  IMAGEKIT_PRIVATE_KEY: z.string().min(1),
  IMAGEKIT_URL_ENDPOINT: z.string().url(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  REGISTER_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  // Express "trust proxy" value for correct client IPs behind a reverse
  // proxy/LB: "true", a hop count ("1"), or comma-separated CIDRs.
  // Unset/"false" = direct exposure (socket peer is the client).
  TRUST_PROXY: z
    .string()
    .optional()
    .transform((value) => {
      const raw = value?.trim();
      if (!raw || raw === "false") {
        return false as const;
      }
      if (raw === "true") {
        return true as const;
      }
      if (/^\d+$/.test(raw)) {
        return Number(raw);
      }
      return raw.split(",").map((entry) => entry.trim()).filter(Boolean);
    }),
  // Strict enum parse (NOT coerce.boolean — "false" would become true).
  // Defaults to enabled; production boot fails when disabled (see index.ts).
  ENABLE_CSRF: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
