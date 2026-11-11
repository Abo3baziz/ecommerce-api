import { Request, Response, NextFunction } from "express";
import { UnauthorizedError } from "../shared/errors/UnauthorizedError.js";
import {
  SESSION_COOKIE_NAME,
  SESSION_IDLE_TIMEOUT_MS,
} from "../shared/constants/session.js";
import { hashToken } from "../modules/auth/utils/tokens.js";
import { authRepository } from "../modules/auth/repository/auth.repository.js";
import { demoPublicPrincipal } from "./demoMode.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export async function authentication(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const token = req.cookies[SESSION_COOKIE_NAME];

    if (!token) {
      // Public demo mode (middleware/demoMode.ts): unauthenticated reads were
      // admitted for safe methods only. Hand them the synthetic principal —
      // never a session, never DB access — so read-only admin endpoints work.
      // The admission middleware re-checks the method, so this is defense in
      // depth against a write sneaking through with the demo flag.
      if (
        req.isDemoPublicRead === true &&
        SAFE_METHODS.has(req.method)
      ) {
        req.user = demoPublicPrincipal as unknown as typeof req.user;
        req.userId = demoPublicPrincipal.public_id;
        next();
        return;
      }
      throw new UnauthorizedError("Authentication required");
    }

    const session = await authRepository.findSessionByTokenHash(hashToken(token));

    if (!session) {
      throw new UnauthorizedError("Invalid session");
    }

    if (session.revoked_at !== null) {
      throw new UnauthorizedError("Session has been revoked");
    }

    if (session.expires_at.getTime() < Date.now()) {
      throw new UnauthorizedError("Session has expired");
    }

    if (
      session.last_activity_at === null ||
      session.last_activity_at.getTime() < Date.now() - SESSION_IDLE_TIMEOUT_MS
    ) {
      throw new UnauthorizedError("Session has been inactive for too long");
    }

    if (session.users.status !== "ACTIVE" || session.users.deleted_at !== null) {
      throw new UnauthorizedError("Account is deactivated");
    }

    await authRepository.touchSession(session.id);

    req.userId = session.users.public_id;
    req.user = session.users;
    req.authSession = {
      id: session.id,
      public_id: session.public_id,
      created_at: session.created_at,
      expires_at: session.expires_at,
    };
    next();
  } catch (error) {
    next(error);
  }
}
