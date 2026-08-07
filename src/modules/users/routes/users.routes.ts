import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { authentication } from "../../../middleware/authentication.js";
import {
  emailChangeRateLimiter,
  passwordChangeRateLimiter,
  phoneChangeRateLimiter,
} from "../../../middleware/rateLimiter.js";
import { updateProfileSchema } from "../validators/updateProfile.js";
import { deleteAccountSchema } from "../validators/deleteAccount.js";
import { changePasswordSchema } from "../validators/changePassword.js";
import { changeEmailSchema } from "../validators/changeEmail.js";
import { verifyEmailChangeSchema } from "../validators/verifyEmailChange.js";
import { changePhoneSchema } from "../validators/changePhone.js";
import { verifyPhoneChangeSchema } from "../validators/verifyPhoneChange.js";
import {
  changeEmailController,
  changePasswordController,
  changePhoneController,
  deleteCurrentUserController,
  getCurrentUserController,
  updateCurrentUserController,
  verifyEmailChangeController,
  verifyPhoneChangeController,
} from "../controller/users.controller.js";

const usersRouter = Router();

usersRouter.use(authentication);

usersRouter.get("/me", getCurrentUserController);
usersRouter.patch("/me", validate(updateProfileSchema), updateCurrentUserController);
usersRouter.delete(
  "/me",
  validate(deleteAccountSchema),
  deleteCurrentUserController,
);
usersRouter.patch(
  "/me/password",
  passwordChangeRateLimiter,
  validate(changePasswordSchema),
  changePasswordController,
);
usersRouter.post(
  "/me/email",
  emailChangeRateLimiter,
  validate(changeEmailSchema),
  changeEmailController,
);
usersRouter.post(
  "/me/email/verify",
  validate(verifyEmailChangeSchema),
  verifyEmailChangeController,
);
usersRouter.post(
  "/me/phone-number",
  phoneChangeRateLimiter,
  validate(changePhoneSchema),
  changePhoneController,
);
usersRouter.post(
  "/me/phone-number/verify",
  validate(verifyPhoneChangeSchema),
  verifyPhoneChangeController,
);

export { usersRouter };
