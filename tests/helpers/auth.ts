import { nanoid } from "nanoid";
import type { Express } from "express";
import request from "supertest";
import { TEST_PASSWORD, createUser } from "../factories/user.factory.js";
import { user_role } from "../../src/generated/prisma/enums.js";
import { randomPhoneNumber } from "./random.js";
import { CSRF_COOKIE_NAME } from "../../src/shared/constants/session.js";

export const CSRF_TOKEN_URL = "/api/v1/auth/csrf-token";

export interface CsrfPair {
  token: string;
  cookie: string;
}

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

export function extractCookieFromSetCookie(
  setCookie: string[] | undefined,
  name: string,
): string | null {
  if (!setCookie) {
    return null;
  }

  const cookie = setCookie.find((cookie) => cookie.startsWith(`${name}=`));
  if (!cookie) {
    return null;
  }

  return cookie.split(";")[0];
}

export function extractSessionCookie(setCookie: string[] | undefined): string | null {
  return extractCookieFromSetCookie(setCookie, "session");
}

export async function fetchCsrfToken(
  app: Express,
  sessionCookie: string,
): Promise<CsrfPair> {
  const response = await request(app)
    .get(CSRF_TOKEN_URL)
    .set("Cookie", sessionCookie);

  const cookie = extractCookieFromSetCookie(
    response.headers["set-cookie"],
    CSRF_COOKIE_NAME,
  );

  if (!response.body.data?.csrf_token || !cookie) {
    throw new Error("fetchCsrfToken failed to obtain a CSRF token");
  }

  return { token: response.body.data.csrf_token, cookie };
}

export function csrfHeaders(
  sessionCookie: string,
  csrf: CsrfPair,
): Record<string, string> {
  return {
    Cookie: `${sessionCookie}; ${csrf.cookie}`,
    "x-csrf-token": csrf.token,
  };
}

export async function registerUser(app: Express, overrides: Record<string, unknown> = {}) {
  const payload = validRegisterPayload(overrides);
  const response = await request(app).post("/api/v1/auth/register").send(payload);
  const cookie = extractSessionCookie(response.headers["set-cookie"]);
  if (!cookie) {
    return { payload, response, cookie, csrf: null };
  }
  const csrf = await fetchCsrfToken(app, cookie);
  return {
    payload,
    response,
    cookie,
    csrf,
  };
}

export async function loginUser(app: Express, email: string, password: string) {
  const response = await request(app)
    .post("/api/v1/auth/login")
    .send({ email, password });
  const cookie = extractSessionCookie(response.headers["set-cookie"]);
  if (!cookie) {
    return { response, cookie, csrf: null };
  }
  const csrf = await fetchCsrfToken(app, cookie);
  return {
    response,
    cookie,
    csrf,
  };
}

export async function createAdminUser(app: Express) {
  const user = await createUser({ role: user_role.ADMIN });
  const { cookie, csrf } = await loginUser(app, user.email, TEST_PASSWORD);
  return { user, cookie, csrf };
}

export async function createSuperAdminUser(app: Express) {
  const user = await createUser({ role: user_role.SUPER_ADMIN });
  const { cookie, csrf } = await loginUser(app, user.email, TEST_PASSWORD);
  return { user, cookie, csrf };
}
