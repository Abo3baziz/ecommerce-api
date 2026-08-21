import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { nanoid } from "nanoid";
import { app } from "../../../src/app/index.js";
import {
  createAdminUser,
  createSuperAdminUser,
  registerUser,
  csrfHeaders,
} from "../../helpers/auth.js";
import { cleanupTestData } from "../../helpers/db.js";
import { createUser } from "../../factories/user.factory.js";
import { user_role, user_status } from "../../../src/generated/prisma/enums.js";

const ADMIN_BASE_URL = "/api/v1/admin/users";

function publicIdFrom(response: request.Response): string {
  return response.body.data.public_id as string;
}

describe("admin users API", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("authentication and authorization", () => {
    it("returns 401 without a session", async () => {
      const response = await request(app).get(ADMIN_BASE_URL);

      expect(response.status).toBe(401);
    });

    it("returns 403 for a non-admin session", async () => {
      const { cookie, csrf } = await registerUser(app);

      const response = await request(app)
        .get(ADMIN_BASE_URL)
        .set("Cookie", cookie!);

      expect(response.status).toBe(403);
    });

    it("returns 200 for a super admin session", async () => {
      const { cookie, csrf } = await createSuperAdminUser(app);

      const response = await request(app)
        .get(ADMIN_BASE_URL)
        .set("Cookie", cookie!);

      expect(response.status).toBe(200);
    });
  });

  describe("GET /api/v1/admin/users", () => {
    it("lists customers with pagination metadata (200)", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const customer = await createUser({ first_name: "Qux" });

      const response = await request(app)
        .get(`${ADMIN_BASE_URL}?search=Qux`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.map((u: { public_id: string }) => u.public_id)).toEqual([
        customer.public_id,
      ]);
      expect(response.body.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        hasNext: false,
        hasPrev: false,
      });
      expect(response.body.data[0]).not.toHaveProperty("id");
      expect(response.body.data[0]).not.toHaveProperty("deleted_at");
      expect(response.body.data[0]).not.toHaveProperty("password_hash");
    });

    it("excludes admins from the list (200)", async () => {
      const { cookie, user, csrf } = await createAdminUser(app);
      await createUser({ first_name: "Qux" });
      await createUser({ first_name: "Qux", role: user_role.ADMIN });

      const response = await request(app)
        .get(`${ADMIN_BASE_URL}?search=Qux`)
        .set("Cookie", cookie!);

      expect(response.body.data.map((u: { public_id: string }) => u.public_id)).not.toEqual(
        expect.arrayContaining([user.public_id]),
      );
      expect(
        response.body.data.some(
          (u: { role: string }) => u.role === user_role.ADMIN,
        ),
      ).toBe(false);
    });

    it("filters by status (200)", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      await createUser({ first_name: "Qux" });
      const suspended = await createUser({
        first_name: "Qux",
        status: user_status.SUSPENDED,
      });

      const response = await request(app)
        .get(`${ADMIN_BASE_URL}?search=Qux&status=SUSPENDED`)
        .set("Cookie", cookie!);

      expect(response.body.data.map((u: { public_id: string }) => u.public_id)).toEqual([
        suspended.public_id,
      ]);
    });

    it("rejects an invalid status filter (400)", async () => {
      const { cookie, csrf } = await createAdminUser(app);

      const response = await request(app)
        .get(`${ADMIN_BASE_URL}?status=BANNED`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(400);
    });
  });

  describe("GET /api/v1/admin/users/:user_public_id", () => {
    it("returns a customer's profile (200)", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const customer = await createUser();

      const response = await request(app)
        .get(`${ADMIN_BASE_URL}/${customer.public_id}`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.public_id).toBe(customer.public_id);
      expect(response.body.data.role).toBe(user_role.CUSTOMER);
      expect(response.body.data).not.toHaveProperty("id");
      expect(response.body.data).not.toHaveProperty("deleted_at");
      expect(response.body.data).not.toHaveProperty("password_hash");
    });

    it("returns 404 for an unknown user", async () => {
      const { cookie, csrf } = await createAdminUser(app);

      const response = await request(app)
        .get(`${ADMIN_BASE_URL}/usr_does_not_exist`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(404);
    });

    it("returns 404 for an admin user", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const admin = await createUser({ role: user_role.ADMIN });

      const response = await request(app)
        .get(`${ADMIN_BASE_URL}/${admin.public_id}`)
        .set("Cookie", cookie!);

      expect(response.status).toBe(404);
    });
  });

  describe("PATCH /api/v1/admin/users/:user_public_id", () => {
    it("updates a customer's names as a regular admin (200)", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const customer = await createUser();

      const response = await request(app)
        .patch(`${ADMIN_BASE_URL}/${customer.public_id}`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ first_name: "Updated", last_name: "Name" });

      expect(response.status).toBe(200);
      expect(response.body.data.first_name).toBe("Updated");
      expect(response.body.data.last_name).toBe("Name");
      expect(response.body.data).not.toHaveProperty("password_hash");
    });

    it("rejects contact-field edits by a regular admin (403)", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const customer = await createUser();

      const response = await request(app)
        .patch(`${ADMIN_BASE_URL}/${customer.public_id}`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ email: `test-hijack-${nanoid(8)}@example.com` });

      expect(response.status).toBe(403);
    });

    it("lets a super admin change the email and resets verification (200)", async () => {
      const { cookie, csrf } = await createSuperAdminUser(app);
      const customer = await createUser({ email_verified_at: new Date() });
      const newEmail = `test-moved-${nanoid(8)}@example.com`;

      const response = await request(app)
        .patch(`${ADMIN_BASE_URL}/${customer.public_id}`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ email: newEmail });

      expect(response.status).toBe(200);
      expect(response.body.data.email).toBe(newEmail);
      expect(response.body.data.email_verified).toBe(false);
    });

    it("returns 409 for an email conflict", async () => {
      const { cookie, csrf } = await createSuperAdminUser(app);
      const first = await createUser({ email: `test-taken-${nanoid(8)}@example.com` });
      const second = await createUser();

      const response = await request(app)
        .patch(`${ADMIN_BASE_URL}/${second.public_id}`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ email: first.email });

      expect(response.status).toBe(409);
    });
  });

  describe("PATCH /api/v1/admin/users/:user_public_id/suspend", () => {
    it("suspends a customer and locks their session (200 then 401)", async () => {
      const { cookie: adminCookie, csrf: adminCsrf } = await createAdminUser(app);
      const { cookie: userCookie, response: userResponse, csrf: userCsrf } = await registerUser(app);
      const userPublicId = publicIdFrom(userResponse);

      const suspendResponse = await request(app)
        .patch(`${ADMIN_BASE_URL}/${userPublicId}/suspend`)
        .set(csrfHeaders(adminCookie!, adminCsrf!))

      expect(suspendResponse.status).toBe(200);
      expect(suspendResponse.body.data.status).toBe(user_status.SUSPENDED);

      const meResponse = await request(app)
        .get("/api/v1/users/me")
        .set("Cookie", userCookie!);

      expect(meResponse.status).toBe(401);
    });

    it("returns 400 when the user is already suspended", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const customer = await createUser({ status: user_status.SUSPENDED });

      const response = await request(app)
        .patch(`${ADMIN_BASE_URL}/${customer.public_id}/suspend`)
        .set(csrfHeaders(cookie!, csrf!))

      expect(response.status).toBe(400);
    });
  });

  describe("PATCH /api/v1/admin/users/:user_public_id/activate", () => {
    it("activates a suspended customer (200)", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const customer = await createUser({ status: user_status.SUSPENDED });

      const response = await request(app)
        .patch(`${ADMIN_BASE_URL}/${customer.public_id}/activate`)
        .set(csrfHeaders(cookie!, csrf!))

      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe(user_status.ACTIVE);
    });

    it("returns 400 when the user is already active", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const customer = await createUser();

      const response = await request(app)
        .patch(`${ADMIN_BASE_URL}/${customer.public_id}/activate`)
        .set(csrfHeaders(cookie!, csrf!))

      expect(response.status).toBe(400);
    });
  });

  describe("PATCH /api/v1/admin/users/:user_public_id/role", () => {
    it("promotes a customer to admin (super admin actor) (200)", async () => {
      const { cookie, csrf } = await createSuperAdminUser(app);
      const { cookie: customerCookie, response: customerResponse } =
        await registerUser(app);
      const customerPublicId = publicIdFrom(customerResponse);

      const response = await request(app)
        .patch(`${ADMIN_BASE_URL}/${customerPublicId}/role`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ role: "ADMIN" });

      expect(response.status).toBe(200);
      expect(response.body.data.public_id).toBe(customerPublicId);
      expect(response.body.data.role).toBe(user_role.ADMIN);
      expect(response.body.data).not.toHaveProperty("id");
      expect(response.body.data).not.toHaveProperty("password_hash");
      expect(response.body.data).not.toHaveProperty("deleted_at");

      const adminAccess = await request(app)
        .get(ADMIN_BASE_URL)
        .set("Cookie", customerCookie!);

      expect(adminAccess.status).toBe(200);
    });

    it("demotes an admin to customer when another admin remains (200)", async () => {
      const { cookie, csrf } = await createSuperAdminUser(app);
      const targetAdmin = await createUser({ role: user_role.ADMIN });

      const response = await request(app)
        .patch(`${ADMIN_BASE_URL}/${targetAdmin.public_id}/role`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ role: "CUSTOMER" });

      expect(response.status).toBe(200);
      expect(response.body.data.role).toBe(user_role.CUSTOMER);
    });

    it("returns 403 when a regular admin attempts a role change", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const customer = await createUser();

      const response = await request(app)
        .patch(`${ADMIN_BASE_URL}/${customer.public_id}/role`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ role: "ADMIN" });

      expect(response.status).toBe(403);
    });

    it("returns 403 when a regular admin attempts to demote the super admin", async () => {
      const { cookie, csrf } = await createAdminUser(app);
      const superAdmin = await createUser({ role: user_role.SUPER_ADMIN });

      const response = await request(app)
        .patch(`${ADMIN_BASE_URL}/${superAdmin.public_id}/role`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ role: "CUSTOMER" });

      expect(response.status).toBe(403);
    });

    it("returns 403 when targeting the super admin even from another super admin", async () => {
      const { cookie, csrf } = await createSuperAdminUser(app);
      const targetSuperAdmin = await createUser({ role: user_role.SUPER_ADMIN });

      const response = await request(app)
        .patch(`${ADMIN_BASE_URL}/${targetSuperAdmin.public_id}/role`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ role: "CUSTOMER" });

      expect(response.status).toBe(403);
    });

    it("returns 200 idempotently when the role already matches", async () => {
      const { cookie, csrf } = await createSuperAdminUser(app);
      const targetAdmin = await createUser({ role: user_role.ADMIN });

      const response = await request(app)
        .patch(`${ADMIN_BASE_URL}/${targetAdmin.public_id}/role`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ role: "ADMIN" });

      expect(response.status).toBe(200);
      expect(response.body.data.role).toBe(user_role.ADMIN);
    });

    it("returns 404 for an unknown user", async () => {
      const { cookie, csrf } = await createSuperAdminUser(app);

      const response = await request(app)
        .patch(`${ADMIN_BASE_URL}/usr_does_not_exist/role`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ role: "ADMIN" });

      expect(response.status).toBe(404);
    });

    it("returns 400 when a super admin changes their own role", async () => {
      const { cookie, user, csrf } = await createSuperAdminUser(app);

      const response = await request(app)
        .patch(`${ADMIN_BASE_URL}/${user.public_id}/role`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ role: "CUSTOMER" });

      expect(response.status).toBe(400);
    });

    it("returns 400 for an invalid role", async () => {
      const { cookie, csrf } = await createSuperAdminUser(app);
      const customer = await createUser();

      const response = await request(app)
        .patch(`${ADMIN_BASE_URL}/${customer.public_id}/role`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ role: "SUPERADMIN" });

      expect(response.status).toBe(400);
    });

    it("returns 400 for the SUPER_ADMIN role (CLI-only grant)", async () => {
      const { cookie, csrf } = await createSuperAdminUser(app);
      const customer = await createUser();

      const response = await request(app)
        .patch(`${ADMIN_BASE_URL}/${customer.public_id}/role`)
        .set(csrfHeaders(cookie!, csrf!))
        .send({ role: "SUPER_ADMIN" });

      expect(response.status).toBe(400);
    });
  });
});
