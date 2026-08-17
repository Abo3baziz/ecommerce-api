import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { authentication } from "../../../middleware/authentication.js";
import { csrfTokenController } from "../../../middleware/csrf.js";
import {
  emailVerificationRateLimiter,
  passwordResetRateLimiter,
} from "../../../middleware/rateLimiter.js";
import { registerSchema } from "../validators/register.js";
import { loginSchema } from "../validators/login.js";
import { verifyEmailSchema } from "../validators/verifyEmail.js";
import { sessionParamsSchema } from "../validators/sessionParams.js";
import {
  requestPasswordResetSchema,
  verifyPasswordResetSchema,
} from "../validators/passwordReset.js";
import {
  loginController,
  registerController,
  getCurrentSessionController,
  listSessionsController,
  logoutController,
  requestPasswordResetController,
  resendVerificationEmailController,
  revokeAllOtherSessionsController,
  revokeSessionController,
  verifyEmailController,
  verifyPasswordResetController,
} from "../controller/auth.controller.js";

const authRouter = Router();

authRouter.get("/csrf-token", authentication, csrfTokenController);

authRouter.post("/register", validate(registerSchema), registerController);
authRouter.post("/login", validate(loginSchema), loginController);
authRouter.get("/session", authentication, getCurrentSessionController);
authRouter.delete("/session", authentication, logoutController);
authRouter.get("/sessions", authentication, listSessionsController);
authRouter.delete(
  "/sessions/:session_public_id",
  authentication,
  validate(sessionParamsSchema),
  revokeSessionController,
);
authRouter.delete("/sessions", authentication, revokeAllOtherSessionsController);
authRouter.post(
  "/email-verification/verify",
  validate(verifyEmailSchema),
  verifyEmailController,
);
authRouter.post(
  "/email-verification/resend",
  authentication,
  emailVerificationRateLimiter,
  resendVerificationEmailController,
);
authRouter.post(
  "/password-reset",
  passwordResetRateLimiter,
  validate(requestPasswordResetSchema),
  requestPasswordResetController,
);
authRouter.post(
  "/password-reset/verify",
  validate(verifyPasswordResetSchema),
  verifyPasswordResetController,
);

export { authRouter };
