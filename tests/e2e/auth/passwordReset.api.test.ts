import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { nanoid } from "nanoid";
import { app } from "../../../src/app/index.js";
import { sendPasswordResetEmail } from "../../../src/shared/mailer/passwordReset.js";
import { loginUser } from "../../helpers/auth.js";
import { createUser, TEST_PASSWORD } from "../../factories/user.factory.js";
import { createVerificationToken } from "../../factories/verification-token.factory.js";
import { verification_type } from "../../../src/generated/prisma/enums.js";
import { cleanupTestData } from "../../helpers/db.js";

vi.mock("../../../src/shared/mailer/passwordReset.js", () => ({
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
}));

const NEW_PASSWORD = "NewStrongPassword456!";

function capturedResetToken(): string {
  const calls = vi.mocked(sendPasswordResetEmail).mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls.at(-1)![2];
}

describe("password reset API", () => {
  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
  });

  describe("POST /api/v1/auth/password-reset", () => {
    it("returns 202 and issues a reset token for an existing user", async () => {
      const user = await createUser();

      const response = await request(app)
        .post("/api/v1/auth/password-reset")
        .send({ email: user.email });

      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain(
        "a password reset email has been sent",
      );
      expect(capturedResetToken()).toMatch(/^[0-9a-f]{64}$/);
    });

    it("returns the same 202 for an unknown email", async () => {
      const response = await request(app)
        .post("/api/v1/auth/password-reset")
        .send({ email: `test-${nanoid(8)}@example.com` });

      expect(response.status).toBe(202);
      expect(response.body.data.message).toContain(
        "a password reset email has been sent",
      );
      expect(sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it("rejects an invalid email (400)", async () => {
      const response = await request(app)
        .post("/api/v1/auth/password-reset")
        .send({ email: "not-an-email" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Validation error");
      expect(response.body.errors).toBeDefined();
    });
  });

  describe("POST /api/v1/auth/password-reset/verify", () => {
    it("resets the password, revokes sessions, and allows login with the new password", async () => {
      const user = await createUser();
      const { cookie, csrf } = await loginUser(app, user.email, TEST_PASSWORD);

      await request(app)
        .post("/api/v1/auth/password-reset")
        .send({ email: user.email });
      const token = capturedResetToken();

      const response = await request(app)
        .post("/api/v1/auth/password-reset/verify")
        .send({ token, new_password: NEW_PASSWORD });

      expect(response.status).toBe(204);

      const staleSession = await request(app)
        .get("/api/v1/auth/session")
        .set("Cookie", cookie!);
      expect(staleSession.status).toBe(401);

      const oldLogin = await loginUser(app, user.email, TEST_PASSWORD);
      expect(oldLogin.response.status).toBe(401);

      const newLogin = await loginUser(app, user.email, NEW_PASSWORD);
      expect(newLogin.response.status).toBe(200);
      expect(newLogin.cookie).toMatch(/^session=[0-9a-f]{64}$/);
    });

    it("returns 410 when the token is used twice", async () => {
      const user = await createUser();

      await request(app)
        .post("/api/v1/auth/password-reset")
        .send({ email: user.email });
      const token = capturedResetToken();

      const first = await request(app)
        .post("/api/v1/auth/password-reset/verify")
        .send({ token, new_password: NEW_PASSWORD });
      expect(first.status).toBe(204);

      const second = await request(app)
        .post("/api/v1/auth/password-reset/verify")
        .send({ token, new_password: "AnotherStrongPassword789!" });
      expect(second.status).toBe(410);
      expect(second.body.success).toBe(false);
    });

    it("returns 404 for an unknown token", async () => {
      const response = await request(app)
        .post("/api/v1/auth/password-reset/verify")
        .send({ token: "f".repeat(64), new_password: NEW_PASSWORD });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Password reset token not found");
    });

    it("returns 410 for an expired token", async () => {
      const user = await createUser();
      await createVerificationToken({
        usersId: user.id,
        rawToken: "expired-token",
        purpose: verification_type.PASSWORD_RESET,
        target: user.email,
        expiresAt: new Date(Date.now() - 1000),
      });

      const response = await request(app)
        .post("/api/v1/auth/password-reset/verify")
        .send({ token: "expired-token", new_password: NEW_PASSWORD });

      expect(response.status).toBe(410);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Password reset token has expired");
    });

    it("rejects a weak new password (400)", async () => {
      const response = await request(app)
        .post("/api/v1/auth/password-reset/verify")
        .send({ token: "f".repeat(64), new_password: "weak" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Validation error");
    });
  });
});