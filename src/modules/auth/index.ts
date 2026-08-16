export { authRouter } from "./routes/auth.routes.js";
export {
  listSessions,
  login,
  register,
  requestPasswordReset,
  resendVerificationEmail,
  revokeAllOtherSessions,
  revokeSession,
  verifyEmail,
  verifyPasswordReset,
} from "./service/auth.service.js";
