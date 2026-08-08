import { nanoid } from "nanoid";
import type { Express } from "express";
import request from "supertest";
import { TEST_PASSWORD } from "../factories/user.factory.js";
import { randomPhoneNumber } from "./random.js";

export function validRegisterPayload(overrides: Record<string, unknown> = {}) {
  return {
    first_name: "Ahmed",
    last_name: "Aziz",
    phone_number: randomPhoneNumber(),
    email: `test-${nanoid(8)}@example.com`,
    password: TEST_PASSWORD,
    ...overrides,
  };
}

export function extractSessionCookie(setCookie: string[] | undefined): string | null {
  if (!setCookie) {
    return null;
  }

  const session = setCookie.find((cookie) => cookie.startsWith("session="));
  if (!session) {
    return null;
  }

  return session.split(";")[0];
}

export async function registerUser(app: Express, overrides: Record<string, unknown> = {}) {
  const payload = validRegisterPayload(overrides);
  const response = await request(app).post("/api/v1/auth/register").send(payload);
  return {
    payload,
    response,
    cookie: extractSessionCookie(response.headers["set-cookie"]),
  };
}

export async function loginUser(app: Express, email: string, password: string) {
  const response = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password });
  return {
    response,
    cookie: extractSessionCookie(response.headers["set-cookie"]),
  };
}
