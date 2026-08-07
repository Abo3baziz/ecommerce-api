import { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../shared/errors/ForbiddenError.js";

export function authorization(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new ForbiddenError("Access denied"));
      return;
    }

    if (roles.length > 0 && !roles.includes(req.user.role)) {
      next(new ForbiddenError("Insufficient permissions"));
      return;
    }

    next();
  };
}
