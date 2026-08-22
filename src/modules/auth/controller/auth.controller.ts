import { Request, Response, NextFunction } from "express";
import {
  listSessions,
  login,
  register,
  requestPasswordReset,
  resendVerificationEmail,
  revokeAllOtherSessions,
  revokeSession,
  verifyEmail,
  verifyOtpPasswordReset,
  verifyPasswordReset,
} from "../service/auth.service.js";
import { authRepository } from "../repository/auth.repository.js";
import { recordAuditEvent } from "../../audit/service/audit.service.js";
import { setSessionCookie, clearSessionCookie } from "../utils/sessionCookie.js";
import type { RegisterInput } from "../dto/register.js";
import type { LoginInput } from "../dto/login.js";
import type { VerifyEmailInput } from "../dto/verifyEmail.js";
import type {
  RequestPasswordResetInput,
  VerifyOtpPasswordResetInput,
  VerifyPasswordResetInput,
} from "../dto/passwordReset.js";
import type { SessionParams } from "../validators/sessionParams.js";
import type { RequestContext } from "../types/context.js";
import type { users } from "../../../generated/prisma/client.js";
import { user_role } from "../../../generated/prisma/enums.js";

function isAdminActor(user: users | undefined): boolean {
  return (
    user !== undefined &&
    (user.role === user_role.ADMIN || user.role === user_role.SUPER_ADMIN)
  );
}

function buildRequestContext(req: Request): RequestContext {
  return {
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  };
}

export async function registerController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { sessionToken, ...data } = await register(
      req.body as RegisterInput,
      buildRequestContext(req),
    );
    setSessionCookie(res, sessionToken);
    res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function loginController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { sessionToken, ...data } = await login(
      req.body as LoginInput,
      buildRequestContext(req),
    );
    setSessionCookie(res, sessionToken);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function getCurrentSessionController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    const authSession = req.authSession!;

    res.status(200).json({
      success: true,
      data: {
        authenticated: true,
        user: {
          public_id: user.public_id,
          email_verified: user.email_verified_at !== null,
        },
        session: {
          created_at: authSession.created_at,
          expires_at: authSession.expires_at,
        },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function logoutController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (req.authSession) {
      await authRepository.revokeSession(req.authSession.id);
      if (isAdminActor(req.user)) {
        void recordAuditEvent({
          actorUsersId: req.user!.id,
          action: "auth.admin.logout",
          entityType: "session",
          entityPublicId: req.authSession.public_id,
          statusCode: 204,
          ipAddress: req.ip ?? null,
          userAgent: req.get("user-agent") ?? null,
        });
      }
    }
    clearSessionCookie(res);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function listSessionsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await listSessions(req.user!.id, req.authSession!.public_id);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function revokeSessionController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { session_public_id } = req.params as SessionParams;
    const revokedCurrent = await revokeSession(
      req.user!.id,
      session_public_id,
      req.authSession!.id,
    );
    if (isAdminActor(req.user)) {
      void recordAuditEvent({
        actorUsersId: req.user!.id,
        action: "auth.admin.session_revoked",
        entityType: "session",
        entityPublicId: session_public_id,
        statusCode: 204,
        ipAddress: req.ip ?? null,
        userAgent: req.get("user-agent") ?? null,
      });
    }
    if (revokedCurrent) {
      clearSessionCookie(res);
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function revokeAllOtherSessionsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await revokeAllOtherSessions(req.user!.id, req.authSession!.id);
    if (isAdminActor(req.user)) {
      void recordAuditEvent({
        actorUsersId: req.user!.id,
        action: "auth.admin.sessions_revoked",
        entityType: "session",
        statusCode: 204,
        requestBody: { except_current: true },
        ipAddress: req.ip ?? null,
        userAgent: req.get("user-agent") ?? null,
      });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function verifyEmailController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await verifyEmail(req.body as VerifyEmailInput);
    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function resendVerificationEmailController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await resendVerificationEmail(req.user!);
    res.status(202).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function requestPasswordResetController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await requestPasswordReset(
      req.body as RequestPasswordResetInput,
    );
    res.status(202).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyPasswordResetController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await verifyPasswordReset(req.body as VerifyPasswordResetInput);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function verifyOtpPasswordResetController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await verifyOtpPasswordReset(
      req.body as VerifyOtpPasswordResetInput,
    );
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}
