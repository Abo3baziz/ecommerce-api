import { Request, Response, NextFunction } from "express";
import { nanoid } from "nanoid";

export function requestId(req: Request, _res: Response, next: NextFunction): void {
  req.headers["x-request-id"] = req.headers["x-request-id"] || nanoid(16);
  next();
}
