import { Request, Response, NextFunction } from "express";
import {
  activateAdminAccount,
  getAdminAccount,
  listAdminAccounts,
  suspendAdminAccount,
} from "../service/admins.service.js";
import { ADMIN_INACTIVE_AFTER_DAYS } from "../../../shared/constants/index.js";
import type {
  AdminAccountParams,
  ListAdminAccountsQuery,
} from "../validators/admin.js";

export async function listAdminAccountsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { page, limit, search, status, activity, sort } =
      req.query as unknown as ListAdminAccountsQuery;
    const data = await listAdminAccounts(
      page,
      limit,
      { search, status, activity },
      ADMIN_INACTIVE_AFTER_DAYS,
      sort.startsWith("-") ? sort.slice(1) : sort,
      sort.startsWith("-"),
    );
    res.status(200).json({
      success: true,
      data: data.accounts,
      pagination: data.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminAccountController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { admin_public_id: adminPublicId } = req.params as AdminAccountParams;
    const data = await getAdminAccount(adminPublicId, ADMIN_INACTIVE_AFTER_DAYS);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function suspendAdminAccountController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { admin_public_id: adminPublicId } = req.params as AdminAccountParams;
    await suspendAdminAccount(adminPublicId, { id: req.user!.id });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function activateAdminAccountController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { admin_public_id: adminPublicId } = req.params as AdminAccountParams;
    await activateAdminAccount(adminPublicId, { id: req.user!.id });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
