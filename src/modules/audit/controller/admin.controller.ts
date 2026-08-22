import { Request, Response, NextFunction } from "express";
import { listAudit } from "../service/audit.service.js";
import type { ListAuditQuery } from "../validators/admin.js";

export async function listAuditController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const {
      page,
      limit,
      actor,
      action,
      entity_type,
      entity_public_id,
      date_from,
      date_to,
    } = req.query as unknown as ListAuditQuery;
    const data = await listAudit(page, limit, {
      actorPublicId: actor,
      actionPrefix: action,
      entityType: entity_type,
      entityPublicId: entity_public_id,
      dateFrom: date_from,
      dateTo: date_to,
    });
    res.status(200).json({
      success: true,
      data: data.entries,
      pagination: data.pagination,
    });
  } catch (error) {
    next(error);
  }
}
