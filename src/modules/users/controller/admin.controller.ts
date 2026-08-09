import { Request, Response, NextFunction } from "express";
import {
  activateUser,
  changeUserRole,
  getAdminUser,
  listAdminUsers,
  suspendUser,
  updateAdminUser,
} from "../service/admin.service.js";
import type {
  AdminUserParams,
  ChangeUserRoleBody,
  ListAdminUsersQuery,
  UpdateAdminUserBody,
} from "../validators/admin.js";

export async function listAdminUsersController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { page, limit, search, status, include_deleted, sort } =
      req.query as unknown as ListAdminUsersQuery;
    const result = await listAdminUsers({
      page,
      limit,
      search,
      status,
      include_deleted,
      sort,
    });
    res.status(200).json({
      success: true,
      data: result.users,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminUserController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { user_public_id } = req.params as AdminUserParams;
    const data = await getAdminUser(user_public_id);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAdminUserController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { user_public_id } = req.params as AdminUserParams;
    const data = await updateAdminUser(
      user_public_id,
      req.body as UpdateAdminUserBody,
    );
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function suspendUserController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { user_public_id } = req.params as AdminUserParams;
    const data = await suspendUser(user_public_id);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function activateUserController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { user_public_id } = req.params as AdminUserParams;
    const data = await activateUser(user_public_id);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function changeUserRoleController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { user_public_id } = req.params as AdminUserParams;
    const data = await changeUserRole(
      { id: req.user!.id, role: req.user!.role },
      user_public_id,
      req.body as ChangeUserRoleBody,
    );
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}
