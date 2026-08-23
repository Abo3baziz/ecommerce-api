import { Request, Response, NextFunction } from "express";
import {
  createCoupon,
  deleteCoupon,
  getCoupon,
  getUsageHistory,
  listCoupons,
  updateCoupon,
} from "../service/coupons.service.js";
import type {
  CouponParams,
  CouponUsagesQuery,
  CreateCouponBody,
  ListCouponsQuery,
  UpdateCouponBody,
} from "../validators/admin.js";

export async function listCouponsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { page, limit, search, status, include_deleted, sort } =
      req.query as unknown as ListCouponsQuery;
    const data = await listCoupons(page, limit, {
      search,
      status,
      includeDeleted: include_deleted,
    }, sort);
    res.status(200).json({
      success: true,
      data: data.coupons,
      pagination: data.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function createCouponController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await createCoupon(
      req.body as CreateCouponBody,
      { id: req.user!.id },
    );
    res.status(201).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getCouponController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { coupon_public_id } = req.params as CouponParams;
    const data = await getCoupon(coupon_public_id);
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function getUsageHistoryController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { coupon_public_id } = req.params as CouponParams;
    const { page, limit } = req.query as unknown as CouponUsagesQuery;
    const data = await getUsageHistory(coupon_public_id, page, limit);
    res.status(200).json({
      success: true,
      data: data.usages.map((usage) => ({
        ...usage,
        discount_amount: usage.discount_amount.toString(),
        redeemed_at: usage.redeemed_at.toISOString(),
      })),
      pagination: data.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateCouponController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { coupon_public_id } = req.params as CouponParams;
    const data = await updateCoupon(
      coupon_public_id,
      req.body as UpdateCouponBody,
      { id: req.user!.id },
    );
    res.status(200).json({ success: true, data });
  } catch (error) {
    next(error);
  }
}

export async function deleteCouponController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { coupon_public_id } = req.params as CouponParams;
    await deleteCoupon(coupon_public_id, { id: req.user!.id });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
