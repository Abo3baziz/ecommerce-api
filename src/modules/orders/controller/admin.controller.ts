import { Request, Response, NextFunction } from "express";
import {
  getAdminOrder,
  listAdminOrders,
  updateOrderStatus,
} from "../service/admin.service.js";
import type {
  AdminOrderParams,
  ListAdminOrdersQuery,
  UpdateOrderStatusBody,
} from "../validators/admin.js";

export async function listAdminOrdersController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = req.query as unknown as ListAdminOrdersQuery;
    const result = await listAdminOrders(query);
    res.status(200).json({
      success: true,
      data: result.orders,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAdminOrderController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { order_public_id } = req.params as AdminOrderParams;
    const data = await getAdminOrder(order_public_id);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateOrderStatusController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { order_public_id } = req.params as AdminOrderParams;
    const data = await updateOrderStatus(
      order_public_id,
      req.body as UpdateOrderStatusBody,
      { id: req.user!.id },
    );
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}
