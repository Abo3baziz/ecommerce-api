import { Request, Response, NextFunction } from "express";
import {
  changeEmail,
  changePassword,
  changePhone,
  deleteAccount,
  getCurrentUser,
  updateProfile,
  verifyEmailChange,
  verifyPhoneChange,
} from "../service/users.service.js";
import { clearSessionCookie } from "../../auth/utils/sessionCookie.js";
import type { UpdateProfileBody } from "../validators/updateProfile.js";
import type { DeleteAccountBody } from "../validators/deleteAccount.js";
import type { ChangePasswordBody } from "../validators/changePassword.js";
import type { ChangeEmailBody } from "../validators/changeEmail.js";
import type { VerifyEmailChangeBody } from "../validators/verifyEmailChange.js";
import type { ChangePhoneBody } from "../validators/changePhone.js";
import type { VerifyPhoneChangeBody } from "../validators/verifyPhoneChange.js";

export async function getCurrentUserController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await getCurrentUser(req.user!.id);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCurrentUserController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await updateProfile(
      req.user!.id,
      req.body as UpdateProfileBody,
    );
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteCurrentUserController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await deleteAccount(req.user!, (req.body as DeleteAccountBody).password);
    clearSessionCookie(res);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function changePasswordController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await changePassword(
      req.user!,
      req.body as ChangePasswordBody,
      req.authSession!.id,
    );
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function changeEmailController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await changeEmail(req.user!, req.body as ChangeEmailBody);
    res.status(202).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyEmailChangeController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await verifyEmailChange(
      req.user!,
      req.body as VerifyEmailChangeBody,
    );
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function changePhoneController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await changePhone(req.user!, req.body as ChangePhoneBody);
    res.status(202).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyPhoneChangeController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await verifyPhoneChange(
      req.user!,
      req.body as VerifyPhoneChangeBody,
    );
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}
