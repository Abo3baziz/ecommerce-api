import { Prisma } from "../generated/prisma/client.js";
import { AppError } from "../shared/errors/AppError.js";
import { BadRequestError } from "../shared/errors/BadRequestError.js";
import { ConflictError } from "../shared/errors/ConflictError.js";
import { NotFoundError } from "../shared/errors/NotFoundError.js";

const PG_STRING_DATA_RIGHT_TRUNCATION = "22001";

const CAUSE_CHAIN_MAX_DEPTH = 5;

interface ErrorWithCause {
  code?: unknown;
  cause?: unknown;
}

function findPostgresErrorCode(error: unknown): string | null {
  let current: unknown = error;

  for (let depth = 0; depth < CAUSE_CHAIN_MAX_DEPTH; depth += 1) {
    if (!(current instanceof Object)) {
      return null;
    }

    const candidate = current as ErrorWithCause;

    if (typeof candidate.code === "string") {
      return candidate.code;
    }

    current = candidate.cause;
  }

  return null;
}

export function mapPrismaError(error: Error): AppError | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return new ConflictError();
    }

    if (error.code === "P2025") {
      return new NotFoundError();
    }

    return null;
  }

  if (findPostgresErrorCode(error) === PG_STRING_DATA_RIGHT_TRUNCATION) {
    return new BadRequestError("A provided value is too long");
  }

  return null;
}
