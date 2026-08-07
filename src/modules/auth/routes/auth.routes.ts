import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { authentication } from "../../../middleware/authentication.js";
import { emailVerificationRateLimiter } from "../../../middleware/rateLimiter.js";
import { registerSchema } from "../validators/register.js";
import { loginSchema } from "../validators/login.js";
import { verifyEmailSchema } from "../validators/verifyEmail.js";
import { sessionParamsSchema } from "../validators/sessionParams.js";
import {
  loginController,
  registerController,
  getCurrentSessionController,
  listSessionsController,
  logoutController,
  resendVerificationEmailController,
  revokeAllOtherSessionsController,
  revokeSessionController,
  verifyEmailController,
} from "../controller/auth.controller.js";

const authRouter = Router();

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

export { authRouter };
