import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

function createRateLimiter(max: number, message: string) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message,
    },
  });
}

export const rateLimiter = createRateLimiter(
  100,
  "Too many requests, please try again later",
);

export const emailVerificationRateLimiter = createRateLimiter(
  5,
  "Too many verification email requests, please try again later",
);

export const emailChangeRateLimiter = createRateLimiter(
  5,
  "Too many email change requests, please try again later",
);

export const phoneChangeRateLimiter = createRateLimiter(
  5,
  "Too many phone number change requests, please try again later",
);

export const passwordChangeRateLimiter = createRateLimiter(
  5,
  "Too many password change attempts, please try again later",
);

export const passwordResetRateLimiter = createRateLimiter(
  5,
  "Too many password reset requests, please try again later",
);

export const loginRateLimiter = createRateLimiter(
  env.LOGIN_RATE_LIMIT_MAX,
  "Too many login attempts, please try again later",
);

export const registerRateLimiter = createRateLimiter(
  env.REGISTER_RATE_LIMIT_MAX,
  "Too many registration attempts, please try again later",
);
