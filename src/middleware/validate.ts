import { Request, Response, NextFunction } from "express";
import { z } from "zod";

type ValidationTarget = {
  body?: unknown;
  query?: unknown;
  params?: unknown;
};

export function validate<T extends ValidationTarget>(schema: z.ZodType<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      _res.status(400).json({
        success: false,
        message: "Validation error",
        errors: result.error.flatten().fieldErrors,
      });
      return;
    }

    const data = result.data;
    req.body = data.body;
    req.params = data.params as Request["params"];
    Object.defineProperty(req, "query", {
      value: data.query,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    next();
  };
}
