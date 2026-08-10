import { Request, Response, NextFunction } from "express";
import {
  getOrder,
  listOrders,
  placeOrder,
} from "../service/orders.service.js";
import type {
  ListOrdersQuery,
  OrderParams,
  PlaceOrderBody,
} from "../validators/orders.js";

export async function placeOrderController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await placeOrder(
      req.user!.id,
      req.body as PlaceOrderBody,
    );
    res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function listOrdersController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = req.query as unknown as ListOrdersQuery;
    const result = await listOrders(req.user!.id, query);
    res.status(200).json({
      success: true,
      data: result.orders,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function getOrderController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { order_public_id } = req.params as OrderParams;
    const data = await getOrder(req.user!.id, order_public_id);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}
