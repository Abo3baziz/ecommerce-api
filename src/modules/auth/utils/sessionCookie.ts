import { Response } from "express";
import { env } from "../../../config/env.js";
import {
  SESSION_COOKIE_NAME,
  SESSION_TTL_MS,
} from "../../../shared/constants/session.js";

const baseOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    ...baseOptions,
    maxAge: SESSION_TTL_MS,
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, baseOptions);
}
