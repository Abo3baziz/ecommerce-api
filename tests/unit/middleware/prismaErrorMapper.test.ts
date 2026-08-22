import { describe, it, expect } from "vitest";
import { Prisma } from "../../../src/generated/prisma/client.js";
import { BadRequestError } from "../../../src/shared/errors/BadRequestError.js";
import { ConflictError } from "../../../src/shared/errors/ConflictError.js";
import { NotFoundError } from "../../../src/shared/errors/NotFoundError.js";
import { mapPrismaError } from "../../../src/middleware/prismaErrorMapper.js";

function knownRequestError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Request failed", {
    code,
    clientVersion: "test",
  });
}

function wrapInCauseChain(cause: unknown, depth: number): Error {
  let current = cause;

  for (let level = 0; level < depth; level += 1) {
    const wrapper = new Error("wrapped");
    (wrapper as { cause?: unknown }).cause = current;
    current = wrapper;
  }

  return current as Error;
}

describe("mapPrismaError", () => {
  it("maps P2002 to a 409 ConflictError with a generic message", () => {
    const mapped = mapPrismaError(knownRequestError("P2002"));

    expect(mapped).toBeInstanceOf(ConflictError);
    expect(mapped?.statusCode).toBe(409);
    expect(mapped?.message).toBe("Resource already exists");
  });

  it("maps P2025 to a 404 NotFoundError", () => {
    const mapped = mapPrismaError(knownRequestError("P2025"));

    expect(mapped).toBeInstanceOf(NotFoundError);
    expect(mapped?.statusCode).toBe(404);
  });

  it("returns null for other known Prisma request errors", () => {
    const mapped = mapPrismaError(knownRequestError("P2003"));

    expect(mapped).toBeNull();
  });

  it("returns null for plain application errors", () => {
    const mapped = mapPrismaError(new Error("boom"));

    expect(mapped).toBeNull();
  });

  it("maps a wrapped Postgres 22001 truncation error to a 400", () => {
    const pgError = Object.assign(new Error("string_data_right_truncation"), {
      code: "22001",
    });
    const wrapped = wrapInCauseChain(pgError, 2);

    const mapped = mapPrismaError(wrapped);

    expect(mapped).toBeInstanceOf(BadRequestError);
    expect(mapped?.statusCode).toBe(400);
  });

  it("returns null when the cause chain carries no relevant Postgres code", () => {
    const pgError = Object.assign(new Error("relation does not exist"), {
      code: "42P01",
    });
    const wrapped = wrapInCauseChain(pgError, 1);

    const mapped = mapPrismaError(wrapped);

    expect(mapped).toBeNull();
  });
});
