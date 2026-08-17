import { Request, Response, NextFunction } from "express";
import { doubleCsrf } from "csrf-csrf";
import { env } from "../config/env.js";
import { ForbiddenError } from "../shared/errors/ForbiddenError.js";
import {
  CSRF_COOKIE_NAME,
  CSRF_TOKEN_HEADER,
  SESSION_COOKIE_NAME,
} from "../shared/constants/session.js";

const { generateCsrfToken, doubleCsrfProtection } = doubleCsrf({
  getSecret: () => env.SESSION_SECRET,
  getSessionIdentifier: (req) => req.cookies[SESSION_COOKIE_NAME] ?? "anonymous",
  cookieName: CSRF_COOKIE_NAME,
  cookieOptions: {
    sameSite: "lax",
    path: "/",
    secure: env.NODE_ENV === "production",
    httpOnly: true,
  },
  getCsrfTokenFromRequest: (req) => req.headers[CSRF_TOKEN_HEADER],
  skipCsrfProtection: (req) => !req.cookies[SESSION_COOKIE_NAME],
});

export function csrfProtection(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  doubleCsrfProtection(req, res, (err?: unknown) => {
    if (err) {
      next(new ForbiddenError("Invalid CSRF token"));
      return;
    }
    next();
  });
}

export function csrfTokenController(
  req: Request,
  res: Response,
): void {
  res.json({
    success: true,
    data: {
      csrf_token: generateCsrfToken(req, res),
    },
  });
}