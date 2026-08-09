export { usersRouter } from "./routes/users.routes.js";
export { adminUsersRouter } from "./routes/admin.routes.js";
export {
  changeEmail,
  changePassword,
  changePhone,
  deleteAccount,
  getCurrentUser,
  updateProfile,
  verifyEmailChange,
  verifyPhoneChange,
} from "./service/users.service.js";
