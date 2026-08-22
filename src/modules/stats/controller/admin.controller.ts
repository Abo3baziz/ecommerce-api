import { Request, Response, NextFunction } from "express";
import { getAdminStats } from "../service/admin.service.js";
import type { GetAdminStatsQuery } from "../validators/admin.js";

export async function getAdminStatsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { period } = req.query as unknown as GetAdminStatsQuery;
    const data = await getAdminStats(period);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}
