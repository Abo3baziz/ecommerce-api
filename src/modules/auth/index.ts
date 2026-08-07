export { authRouter } from "./routes/auth.routes.js";
export {
  listSessions,
  login,
  register,
  resendVerificationEmail,
  revokeAllOtherSessions,
  revokeSession,
  verifyEmail,
} from "./service/auth.service.js";
