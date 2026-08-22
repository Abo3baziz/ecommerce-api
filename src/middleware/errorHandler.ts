import { Request, Response, NextFunction } from "express";
import { AppError } from "../shared/errors/AppError.js";
import { mapPrismaError } from "./prismaErrorMapper.js";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  res.locals.error = err;

  const appError = err instanceof AppError ? err : mapPrismaError(err);

  if (appError) {
    res.status(appError.statusCode).json({
      success: false,
      message: appError.message,
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}
