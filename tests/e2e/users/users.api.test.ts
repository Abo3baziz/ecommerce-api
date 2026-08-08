import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import { nanoid } from "nanoid";
import { app } from "../../../src/app/index.js";
import { sendEmailChangeVerificationEmail } from "../../../src/shared/mailer/emailChange.js";
import { sendSms } from "../../../src/shared/sms/index.js";
import { loginUser, registerUser } from "../../helpers/auth.js";
import { TEST_PASSWORD } from "../../factories/user.factory.js";
import { cleanupTestData } from "../../helpers/db.js";
import { randomPhoneNumber } from "../../helpers/random.js";

vi.mock("../../../src/shared/mailer/emailChange.js", () => ({
  sendEmailChangeVerificationEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../../src/shared/sms/index.js", () => ({
  sendSms: vi.fn().mockResolvedValue(undefined),
}));

function capturedEmailToken(): string {
  const calls = vi.mocked(sendEmailChangeVerificationEmail).mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  return calls.at(-1)![2];
}

function capturedOtp(): string {
  const calls = vi.mocked(sendSms).mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  const match = (calls.at(-1)![0].message as string).match(/\d{6}/);
  expect(match).not.toBeNull();
  return match![0];
}

describe("users API", () => {
  beforeEach(async () => {
    await cleanupTestData();
    vi.clearAllMocks();
  });

  describe("GET /api/v1/users/me", () => {
    it("rejects a request without authentication (401)", async () => {
      const response = await request(app).get("/api/v1/users/me");

      expect(response.status).toBe(401);
    });

    it("returns the current user profile (200)", async () => {
      const { cookie } = await registerUser(app);

      const response = await request(app)
        .get("/api/v1/users/me")
        .set("Cookie", cookie!);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.public_id).toMatch(/^usr_/);
      expect(response.body.data).not.toHaveProperty("id");
      expect(response.body.data).not.toHaveProperty("password_hash");
      expect(response.body.data.email_verified).toBe(false);
    });
  });

  describe("PATCH /api/v1/users/me", () => {
    it("updates the current user profile (200)", async () => {
      const { cookie } = await registerUser(app);

      const response = await request(app)
        .patch("/api/v1/users/me")
        .set("Cookie", cookie!)
        .send({ first_name: "Omar", last_name: "Hassan" });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.first_name).toBe("Omar");
      expect(response.body.data.last_name).toBe("Hassan");
    });

    it("rejects an invalid payload (400)", async () => {
      const { cookie } = await registerUser(app);

      const response = await request(app)
        .patch("/api/v1/users/me")
        .set("Cookie", cookie!)
        .send({ first_name: "" });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe("Validation error");
    });
  });

  describe("DELETE /api/v1/users/me", () => {
    it("deletes the account with a valid password (204)", async () => {
      const { cookie } = await registerUser(app);

      const response = await request(app)
        .delete("/api/v1/users/me")
        .set("Cookie", cookie!)
        .send({ password: TEST_PASSWORD });

      expect(response.status).toBe(204);

      const meResponse = await request(app)
        .get("/api/v1/users/me")
        .set("Cookie", cookie!);
      expect(meResponse.status).toBe(401);
    });

    it("rejects an incorrect password (401)", async () => {
      const { cookie } = await registerUser(app);

      const response = await request(app)
        .delete("/api/v1/users/me")
        .set("Cookie", cookie!)
        .send({ password: "WrongPassword123!" });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe("PATCH /api/v1/users/me/password", () => {
    it("changes the password and keeps the current session (204)", async () => {
      const { payload, cookie } = await registerUser(app);
      const newPassword = "NewStrongPassword456!";

      const response = await request(app)
        .patch("/api/v1/users/me/password")
        .set("Cookie", cookie!)
        .send({ current_password: TEST_PASSWORD, new_password: newPassword });

      expect(response.status).toBe(204);

      const meResponse = await request(app)
        .get("/api/v1/users/me")
        .set("Cookie", cookie!);
      expect(meResponse.status).toBe(200);

      const oldLogin = await loginUser(app, payload.email, TEST_PASSWORD);
      expect(oldLogin.response.status).toBe(401);

      const newLogin = await loginUser(app, payload.email, newPassword);
      expect(newLogin.response.status).toBe(200);
    });

    it("rejects an incorrect current password (401)", async () => {
      const { cookie } = await registerUser(app);

      const response = await request(app)
        .patch("/api/v1/users/me/password")
        .set("Cookie", cookie!)
        .send({
          current_password: "WrongPassword123!",
          new_password: "NewStrongPassword456!",
        });

      expect(response.status).toBe(401);
    });

    it("rejects a new password equal to the current one (400)", async () => {
      const { cookie } = await registerUser(app);

      const response = await request(app)
        .patch("/api/v1/users/me/password")
        .set("Cookie", cookie!)
        .send({ current_password: TEST_PASSWORD, new_password: TEST_PASSWORD });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/v1/users/me/email", () => {
    it("issues a change email request (202)", async () => {
      const { cookie } = await registerUser(app);
      const new_email = `test-${nanoid(8)}@example.com`;

      const response = await request(app)
        .post("/api/v1/users/me/email")
        .set("Cookie", cookie!)
        .send({ password: TEST_PASSWORD, new_email });

      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe("Verification email sent.");
    });

    it("rejects an email already in use (409)", async () => {
      const first = await registerUser(app);
      const { cookie } = await registerUser(app);

      const response = await request(app)
        .post("/api/v1/users/me/email")
        .set("Cookie", cookie!)
        .send({ password: TEST_PASSWORD, new_email: first.payload.email });

      expect(response.status).toBe(409);
      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/v1/users/me/email/verify", () => {
    it("verifies the new email (200)", async () => {
      const { cookie } = await registerUser(app);
      const new_email = `test-${nanoid(8)}@example.com`;
      await request(app)
        .post("/api/v1/users/me/email")
        .set("Cookie", cookie!)
        .send({ password: TEST_PASSWORD, new_email });
      const token = capturedEmailToken();

      const response = await request(app)
        .post("/api/v1/users/me/email/verify")
        .set("Cookie", cookie!)
        .send({ token });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(new_email);
      expect(response.body.data.email_verified).toBe(true);

      const meResponse = await request(app)
        .get("/api/v1/users/me")
        .set("Cookie", cookie!);
      expect(meResponse.body.data.email).toBe(new_email);
    });

    it("returns 404 for an unknown token", async () => {
      const { cookie } = await registerUser(app);

      const response = await request(app)
        .post("/api/v1/users/me/email/verify")
        .set("Cookie", cookie!)
        .send({ token: `test-${nanoid(20)}` });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe("POST /api/v1/users/me/phone-number", () => {
    it("issues a phone change request (202)", async () => {
      const { cookie } = await registerUser(app);

      const response = await request(app)
        .post("/api/v1/users/me/phone-number")
        .set("Cookie", cookie!)
        .send({ password: TEST_PASSWORD, new_phone_number: randomPhoneNumber() });

      expect(response.status).toBe(202);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe("Verification code sent.");
    });
  });

  describe("POST /api/v1/users/me/phone-number/verify", () => {
    it("verifies the new phone number (200)", async () => {
      const { cookie } = await registerUser(app);
      const new_phone_number = randomPhoneNumber();
      await request(app)
        .post("/api/v1/users/me/phone-number")
        .set("Cookie", cookie!)
        .send({ password: TEST_PASSWORD, new_phone_number });
      const otp = capturedOtp();

      const response = await request(app)
        .post("/api/v1/users/me/phone-number/verify")
        .set("Cookie", cookie!)
        .send({ otp });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.phone_number).toBe(new_phone_number);

      const meResponse = await request(app)
        .get("/api/v1/users/me")
        .set("Cookie", cookie!);
      expect(meResponse.body.data.phone_number).toBe(new_phone_number);
    });

    it("rejects an invalid code (400)", async () => {
      const { cookie } = await registerUser(app);
      await request(app)
        .post("/api/v1/users/me/phone-number")
        .set("Cookie", cookie!)
        .send({ password: TEST_PASSWORD, new_phone_number: randomPhoneNumber() });
      const realOtp = capturedOtp();
      const wrongOtp = realOtp === "000000" ? "000001" : "000000";

      const response = await request(app)
        .post("/api/v1/users/me/phone-number/verify")
        .set("Cookie", cookie!)
        .send({ otp: wrongOtp });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
