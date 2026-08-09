import { Request, Response, NextFunction } from "express";
import {
  createInventory,
  getInventory,
  listInventory,
  updateInventory,
} from "../service/inventory.service.js";
import type {
  CreateInventoryBody,
  InventoryParams,
  ListInventoryQuery,
  UpdateInventoryBody,
} from "../validators/inventory.js";

export async function listInventoryController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { page, limit, search, stock_status, include_deleted, sort } =
      req.query as unknown as ListInventoryQuery;
    const result = await listInventory(
      page,
      limit,
      search,
      stock_status,
      include_deleted,
      sort,
    );
    res.status(200).json({
      success: true,
      data: result.inventory,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function createInventoryController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await createInventory(req.body as CreateInventoryBody);
    res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function getInventoryController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { variant_public_id } = req.params as InventoryParams;
    const data = await getInventory(variant_public_id);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateInventoryController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { variant_public_id } = req.params as InventoryParams;
    const data = await updateInventory(
      variant_public_id,
      req.body as UpdateInventoryBody,
      { id: req.user!.id, role: req.user!.role },
    );
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}
