import { Request, Response, NextFunction } from "express";
import { AppError } from "../shared/errors/AppError.js";
import { logger } from "../shared/logger/index.js";

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
    });
    return;
  }

  logger.error({ err, requestId: req.headers["x-request-id"] }, "Unhandled error");

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
}
