import { Request, Response, NextFunction } from "express";
import {
  addCartItem,
  clearCart,
  getCart,
  removeCartItem,
  updateCartItemQuantity,
} from "../service/cart.service.js";
import type {
  AddCartItemBody,
  CartItemParams,
  UpdateCartItemBody,
} from "../validators/cart.js";

export async function getCartController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await getCart(req.user!.id);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function addCartItemController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await addCartItem(
      req.user!.id,
      req.body as AddCartItemBody,
    );
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCartItemController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { variant_public_id } = req.params as CartItemParams;
    const data = await updateCartItemQuantity(
      req.user!.id,
      variant_public_id,
      req.body as UpdateCartItemBody,
    );
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function removeCartItemController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { variant_public_id } = req.params as CartItemParams;
    await removeCartItem(req.user!.id, variant_public_id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function clearCartController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await clearCart(req.user!.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
