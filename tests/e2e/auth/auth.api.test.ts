import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { nanoid } from "nanoid";
import { app } from "../../../src/app/index.js";
import { sendVerificationEmail } from "../../../src/shared/mailer/verification.js";
import {
  extractSessionCookie,
  loginUser,
  registerUser,
  csrfHeaders,
} from "../../helpers/auth.js";
import { TEST_PASSWORD } from "../../factories/user.factory.js";
import { cleanupTestData } from "../../helpers/db.js";

vi.mock("../../../src/shared/mailer/verification.js", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

function capturedVerificationToken(): string {
  const calls = vi.mocked(sendVerificationEmail).mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls.at(-1)![2];
}

describe("auth API", () => {
  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
  });

  describe("POST /api/v1/auth/register", () => {
    it("registers a user and sets a session cookie (201)", async () => {
      const { response, cookie, csrf } = await registerUser(app);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.public_id).toMatch(/^usr_/);
      expect(response.body.data.email_verified).toBe(false);
      expect(response.body.data).not.toHaveProperty("id");
      expect(cookie).toMatch(/^session=[0-9a-f]{64}$/);
    });

    it("rejects a duplicate email (409)", async () => {
      const { payload } = await registerUser(app);

      const { response } = await registerUser(app, { email: payload.email });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Email is already registered");
    });

    it("rejects a duplicate phone number (409)", async () => {
      const { payload } = await registerUser(app);

      const { response } = await registerUser(app, {
        phone_number: payload.phone_number,
      });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Phone number is already registered");
    });

    it("rejects an invalid payload (400)", async () => {
      const { response } = await registerUser(app, { email: "not-an-email" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Validation error");
      expect(response.body.errors).toBeDefined();
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("authenticates valid credentials and sets a session cookie (200)", async () => {
      const { payload } = await registerUser(app);

      const { response, cookie, csrf } = await loginUser(app, payload.email, TEST_PASSWORD);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.public_id).toMatch(/^usr_/);
      expect(cookie).toMatch(/^session=[0-9a-f]{64}$/);
    });

    it("rejects a wrong password (401)", async () => {
      const { payload } = await registerUser(app);

      const { response } = await loginUser(app, payload.email, "WrongPassword123!");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Invalid email or password");
    });

    it("rejects an unknown email (401)", async () => {
      const { response } = await loginUser(
        app,
        `test-${nanoid(8)}@example.com`,
        TEST_PASSWORD,
      );

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe("GET /api/v1/auth/session", () => {
    it("returns the current session for an authenticated request (200)", async () => {
      const { cookie, csrf } = await registerUser(app);

      const response = await request(app)
        .get("/api/v1/auth/session")
        .set("Cookie", cookie!);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.authenticated).toBe(true);
      expect(response.body.data.user.public_id).toMatch(/^usr_/);
      expect(response.body.data.user.email_verified).toBe(false);
      expect(response.body.data.session).toHaveProperty("created_at");
      expect(response.body.data.session).toHaveProperty("expires_at");
    });

    it("rejects a request without a session cookie (401)", async () => {
      const response = await request(app).get("/api/v1/auth/session");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Authentication required");
    });
  });

  describe("DELETE /api/v1/auth/session", () => {
    it("logs out and clears the session cookie (204)", async () => {
      const { cookie, csrf } = await registerUser(app);

      const response = await request(app)
        .delete("/api/v1/auth/session")
        .set(csrfHeaders(cookie!, csrf!))

      expect(response.status).toBe(204);
      expect(extractSessionCookie(response.headers["set-cookie"])).toBe("session=");

      const sessionResponse = await request(app)
        .get("/api/v1/auth/session")
        .set("Cookie", cookie!);
      expect(sessionResponse.status).toBe(401);
    });

    it("rejects logout without authentication (401)", async () => {
      const response = await request(app).delete("/api/v1/auth/session");

      expect(response.status).toBe(401);
    });
  });

  describe("GET /api/v1/auth/sessions", () => {
    it("lists sessions with the current flag (200)", async () => {
      const { payload } = await registerUser(app);
      const second = await loginUser(app, payload.email, TEST_PASSWORD);

      const response = await request(app)
        .get("/api/v1/auth/sessions")
        .set("Cookie", second.cookie!);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(
        response.body.data.filter((session: { current: boolean }) => session.current),
      ).toHaveLength(1);
      expect(response.body.data[0].public_id).toMatch(/^ses_/);
    });

    it("rejects a request without authentication (401)", async () => {
      const response = await request(app).get("/api/v1/auth/sessions");

      expect(response.status).toBe(401);
    });
  });

  describe("DELETE /api/v1/auth/sessions/:session_public_id", () => {
    it("revokes another session (204)", async () => {
      const { payload, cookie: firstCookie, csrf: firstCsrf } = await registerUser(app);
      const second = await loginUser(app, payload.email, TEST_PASSWORD);

      const sessionsResponse = await request(app)
        .get("/api/v1/auth/sessions")
        .set("Cookie", second.cookie!);
      const otherSession = sessionsResponse.body.data.find(
        (session: { current: boolean }) => !session.current,
      );

      const response = await request(app)
        .delete(`/api/v1/auth/sessions/${otherSession.public_id}`)
        .set(csrfHeaders(second.cookie!, second.csrf!))
      expect(response.status).toBe(204);

      const sessionResponse = await request(app)
        .get("/api/v1/auth/session")
        .set("Cookie", firstCookie!);
      expect(sessionResponse.status).toBe(401);
    });

    it("returns 404 for an unknown session", async () => {
      const { cookie, csrf } = await registerUser(app);

      const response = await request(app)
        .delete(`/api/v1/auth/sessions/ses_${nanoid(10)}`)
        .set(csrfHeaders(cookie!, csrf!))

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it("rejects a request without authentication (401)", async () => {
      const response = await request(app).delete(
        `/api/v1/auth/sessions/ses_${nanoid(10)}`,
      );

      expect(response.status).toBe(401);
    });
  });

  describe("DELETE /api/v1/auth/sessions", () => {
    it("revokes all other sessions (204)", async () => {
      const { payload, cookie: firstCookie, csrf: firstCsrf } = await registerUser(app);
      const second = await loginUser(app, payload.email, TEST_PASSWORD);

      const response = await request(app)
        .delete("/api/v1/auth/sessions")
        .set(csrfHeaders(second.cookie!, second.csrf!))
      expect(response.status).toBe(204);

      const sessionResponse = await request(app)
        .get("/api/v1/auth/session")
        .set("Cookie", firstCookie!);
      expect(sessionResponse.status).toBe(401);
    });
  });

  describe("POST /api/v1/auth/email-verification/verify", () => {
    it("verifies the email with a valid token (200)", async () => {
      await registerUser(app);
      const token = capturedVerificationToken();

      const response = await request(app)
        .post("/api/v1/auth/email-verification/verify")
        .send({ token });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe("Email verified successfully.");
    });

    it("returns 410 for a token that has already been used", async () => {
      await registerUser(app);
      const token = capturedVerificationToken();
      await request(app)
        .post("/api/v1/auth/email-verification/verify")
        .send({ token });

      const response = await request(app)
        .post("/api/v1/auth/email-verification/verify")
        .send({ token });

      expect(response.status).toBe(410);
      expect(response.body.success).toBe(false);
    });

    it("returns 404 for an unknown token", async () => {
      const response = await request(app)
        .post("/api/v1/auth/email-verification/verify")
        .send({ token: `test-${nanoid(20)}` });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it("returns 400 for an empty token", async () => {
      const response = await request(app)
        .post("/api/v1/auth/email-verification/verify")
        .send({ token: "" });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Validation error");
    });
  });

  describe("POST /api/v1/auth/email-verification/resend", () => {
    it("resends a verification email (202)", async () => {
      const { cookie, csrf } = await registerUser(app);

      const response = await request(app)
        .post("/api/v1/auth/email-verification/resend")
        .set(csrfHeaders(cookie!, csrf!))

      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe("Verification email sent.");
      expect(vi.mocked(sendVerificationEmail)).toHaveBeenCalledTimes(2);
    });

    it("rejects a request without authentication (401)", async () => {
      const response = await request(app).post(
        "/api/v1/auth/email-verification/resend",
      );

      expect(response.status).toBe(401);
    });
  });
});
