import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { app } from "../../../src/app/index.js";
import {
  CSRF_COOKIE_NAME,
  CSRF_TOKEN_HEADER,
} from "../../../src/shared/constants/session.js";
import {
  fetchCsrfToken,
  registerUser,
  loginUser,
  csrfHeaders,
  CSRF_TOKEN_URL,
} from "../../helpers/auth.js";
import { TEST_PASSWORD, createUser } from "../../factories/user.factory.js";
import { cleanupTestData } from "../../helpers/db.js";

vi.mock("../../../src/shared/mailer/verification.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

describe("CSRF protection", () => {
  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
  });

  describe(`GET ${CSRF_TOKEN_URL}`, () => {
    it("returns 401 without a session", async () => {
      const response = await request(app).get(CSRF_TOKEN_URL);

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("returns a token and sets the CSRF cookie for an authenticated user", async () => {
      const { cookie, csrf } = await registerUser(app);

      const response = await request(app)
        .get(CSRF_TOKEN_URL)
        .set("Cookie", cookie!);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.csrf_token).toMatch(/^[0-9a-f]+\.\w+$/);

      const setCookie = response.headers["set-cookie"];
      const csrfCookie = setCookie.find((c: string) =>
        c.startsWith(`${CSRF_COOKIE_NAME}=`),
      );
      expect(csrfCookie).toBeDefined();
      expect(csrfCookie).toContain("HttpOnly");
      expect(csrfCookie).toContain("Path=/");
    });
  });

  describe("rejection", () => {
    it("returns 403 for a cookie-authenticated write without a CSRF token", async () => {
      const { cookie, csrf } = await registerUser(app);

      const response = await request(app)
        .patch("/api/v1/users/me")
        .set("Cookie", cookie!)
        .send({ first_name: "Ali" });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Invalid CSRF token");
    });

    it("returns 403 when the CSRF cookie is present but the header is missing", async () => {
      const { cookie, csrf } = await registerUser(app);

      const response = await request(app)
        .patch("/api/v1/users/me")
        .set("Cookie", `${cookie!}; ${csrf!.cookie}`)
        .send({ first_name: "Ali" });

      expect(response.status).toBe(403);
    });

    it("returns 403 when the header does not match the CSRF cookie", async () => {
      const { cookie, csrf } = await registerUser(app);

      const response = await request(app)
        .patch("/api/v1/users/me")
        .set("Cookie", `${cookie!}; ${csrf!.cookie}`)
        .set(CSRF_TOKEN_HEADER, "00ff".repeat(16))
        .send({ first_name: "Ali" });

      expect(response.status).toBe(403);
    });

    it("returns 403 for every cookie-authenticated write method", async () => {
      const { cookie, csrf } = await registerUser(app);

      const patch = await request(app)
        .patch("/api/v1/users/me")
        .set("Cookie", cookie!)
        .send({ first_name: "Ali" });
      const remove = await request(app)
        .delete("/api/v1/auth/session")
        .set("Cookie", cookie!);
      const post = await request(app)
        .post("/api/v1/auth/email-verification/resend")
        .set("Cookie", cookie!);

      expect(patch.status).toBe(403);
      expect(remove.status).toBe(403);
      expect(post.status).toBe(403);
    });
  });

  describe("happy path", () => {
    it("accepts a valid CSRF token on a cookie-authenticated write", async () => {
      const { cookie, csrf } = await registerUser(app);

      const response = await request(app)
        .patch("/api/v1/users/me")
        .set(csrfHeaders(cookie!, csrf!))
        .send({ first_name: "Ali" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.first_name).toBe("Ali");
    });

    it("accepts CSRF on an admin write", async () => {
      const user = await createUser();
      const { cookie, csrf } = await loginUser(app, user.email, TEST_PASSWORD);

      const response = await request(app)
        .delete("/api/v1/auth/session")
        .set(csrfHeaders(cookie!, csrf!))

      expect(response.status).toBe(204);
    });

    it("does not require a CSRF token for safe methods", async () => {
      const { cookie, csrf } = await registerUser(app);

      const response = await request(app)
        .get("/api/v1/users/me")
        .set("Cookie", cookie!);

      expect(response.status).toBe(200);
    });

    it("returns a fresh token bound to the session after re-login", async () => {
      const { payload } = await registerUser(app);
      const first = await fetchCsrfToken(app, (await registerUser(app)).cookie!);

      const { cookie, csrf } = await loginUser(app, payload.email, TEST_PASSWORD);

      expect(csrf!.token).not.toBe(first.token);
      expect(csrf!.cookie).not.toBe(first.cookie);

      const response = await request(app)
        .patch("/api/v1/users/me")
        .set(csrfHeaders(cookie!, csrf!))
        .send({ first_name: "Ali" });

      expect(response.status).toBe(200);
    });
  });

  describe("public endpoints", () => {
    it("allows anonymous login without a CSRF token", async () => {
      const { payload } = await registerUser(app);

      const response = await request(app)
        .post("/api/v1/auth/login")
        .send({ email: payload.email, password: TEST_PASSWORD });

      expect(response.status).toBe(200);
    });

    it("allows anonymous register without a CSRF token", async () => {
      const { response } = await registerUser(app);

      expect(response.status).toBe(201);
    });

    it("allows password reset without a CSRF token", async () => {
      const user = await createUser();

      const response = await request(app)
        .post("/api/v1/auth/password-reset")
        .send({ email: user.email });

      expect(response.status).toBe(202);
    });
  });
});