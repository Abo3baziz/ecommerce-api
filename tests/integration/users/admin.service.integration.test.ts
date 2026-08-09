import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { nanoid } from "nanoid";
import {
  activateUser,
  changeUserRole,
  getAdminUser,
  listAdminUsers,
  suspendUser,
  updateAdminUser,
} from "../../../src/modules/users/service/admin.service.js";
import { prisma } from "../../../src/config/database.js";
import { BadRequestError } from "../../../src/shared/errors/BadRequestError.js";
import { ConflictError } from "../../../src/shared/errors/ConflictError.js";
import { ForbiddenError } from "../../../src/shared/errors/ForbiddenError.js";
import { NotFoundError } from "../../../src/shared/errors/NotFoundError.js";
import { user_role, user_status } from "../../../src/generated/prisma/enums.js";
import { usersRepository } from "../../../src/modules/users/repository/users.repository.js";
import { createSessionForUser } from "../../factories/session.factory.js";
import { createUser } from "../../factories/user.factory.js";
import { cleanupTestData } from "../../helpers/db.js";
import { randomPhoneNumber } from "../../helpers/random.js";

function uniqueEmail(prefix = "email"): string {
  return `test-admin-${prefix}-${nanoid(8)}@example.com`;
}

describe("admin.service", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("listAdminUsers", () => {
    it("lists only customers, excluding admins and deleted users", async () => {
      const customer = await createUser({ first_name: "Qux" });
      const admin = await createUser({ first_name: "Qux", role: user_role.ADMIN });
      const deleted = await createUser({ first_name: "Qux", deleted_at: new Date() });

      const result = await listAdminUsers({
        page: 1,
        limit: 20,
        search: "Qux",
        status: undefined,
        include_deleted: false,
        sort: "-created_at",
      });

      expect(result.users.map((u) => u.public_id)).toEqual([customer.public_id]);
      expect(result.users).not.toEqual(
        expect.arrayContaining([admin.public_id, deleted.public_id]),
      );
      expect(result.users[0]).not.toHaveProperty("id");
      expect(result.users[0]).not.toHaveProperty("deleted_at");
      expect(result.users[0]).not.toHaveProperty("password_hash");
    });

    it("includes deleted customers when include_deleted is true", async () => {
      const customer = await createUser({ first_name: "Qux" });
      const deleted = await createUser({ first_name: "Qux", deleted_at: new Date() });

      const result = await listAdminUsers({
        page: 1,
        limit: 20,
        search: "Qux",
        status: undefined,
        include_deleted: true,
        sort: "-created_at",
      });

      expect(result.users.map((u) => u.public_id)).toEqual(
        expect.arrayContaining([customer.public_id, deleted.public_id]),
      );
    });

    it("filters by status", async () => {
      await createUser({ first_name: "Qux" });
      const suspended = await createUser({
        first_name: "Qux",
        status: user_status.SUSPENDED,
      });

      const result = await listAdminUsers({
        page: 1,
        limit: 20,
        search: "Qux",
        status: user_status.SUSPENDED,
        include_deleted: false,
        sort: "-created_at",
      });

      expect(result.users.map((u) => u.public_id)).toEqual([suspended.public_id]);
    });

    it("searches by name and email", async () => {
      const byName = await createUser({ first_name: "Searchable" });
      const byEmail = await createUser({ email: uniqueEmail("search") });
      await createUser();

      const result = await listAdminUsers({
        page: 1,
        limit: 20,
        search: "search",
        status: undefined,
        include_deleted: false,
        sort: "-created_at",
      });

      expect(result.users.map((u) => u.public_id)).toEqual(
        expect.arrayContaining([byName.public_id, byEmail.public_id]),
      );
    });

    it("searches by phone number", async () => {
      const byPhone = await createUser({ phone_number: "+15551234567" });
      await createUser();

      const result = await listAdminUsers({
        page: 1,
        limit: 20,
        search: "1555",
        status: undefined,
        include_deleted: false,
        sort: "-created_at",
      });

      expect(result.users.map((u) => u.public_id)).toEqual([byPhone.public_id]);
    });

    it("paginates results", async () => {
      await createUser({ first_name: "Zedtest" });
      await createUser({ first_name: "Zedtest" });
      await createUser({ first_name: "Zedtest" });

      const result = await listAdminUsers({
        page: 1,
        limit: 2,
        search: "Zedtest",
        status: undefined,
        include_deleted: false,
        sort: "-created_at",
      });

      expect(result.users).toHaveLength(2);
      expect(result.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: 3,
        totalPages: 2,
        hasNext: true,
        hasPrev: false,
      });
    });
  });

  describe("getAdminUser", () => {
    it("returns a customer's profile without sensitive fields", async () => {
      const user = await createUser();

      const result = await getAdminUser(user.public_id);

      expect(result.public_id).toBe(user.public_id);
      expect(result.role).toBe(user_role.CUSTOMER);
      expect(result.status).toBe(user_status.ACTIVE);
      expect(result).not.toHaveProperty("id");
      expect(result).not.toHaveProperty("deleted_at");
      expect(result).not.toHaveProperty("password_hash");
    });

    it("throws 404 for an unknown user", async () => {
      await expect(getAdminUser("usr_does_not_exist")).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });

    it("throws 404 for an admin user", async () => {
      const admin = await createUser({ role: user_role.ADMIN });

      await expect(getAdminUser(admin.public_id)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws 404 for a deleted customer", async () => {
      const user = await createUser({ deleted_at: new Date() });

      await expect(getAdminUser(user.public_id)).rejects.toBeInstanceOf(NotFoundError);
    });
  });

  describe("updateAdminUser", () => {
    it("updates names, email, and phone number", async () => {
      const user = await createUser();
      const newPhone = randomPhoneNumber();

      const result = await updateAdminUser(user.public_id, {
        first_name: "Updated",
        last_name: "Name",
        email: uniqueEmail("updated"),
        phone_number: newPhone,
      });

      expect(result.first_name).toBe("Updated");
      expect(result.last_name).toBe("Name");
      expect(result.email.startsWith("test-admin-updated-")).toBe(true);
      expect(result.phone_number).toBe(newPhone);
    });

    it("throws 404 for an unknown user", async () => {
      await expect(
        updateAdminUser("usr_does_not_exist", { first_name: "X" }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws 409 when the email is already in use", async () => {
      const first = await createUser({ email: uniqueEmail("taken") });
      const second = await createUser();

      await expect(
        updateAdminUser(second.public_id, { email: first.email }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("throws 409 when the phone number is already in use", async () => {
      const first = await createUser({ phone_number: "+15551234567" });
      const second = await createUser();

      await expect(
        updateAdminUser(second.public_id, { phone_number: first.phone_number }),
      ).rejects.toBeInstanceOf(ConflictError);
    });
  });

  describe("suspendUser", () => {
    it("suspends a customer and revokes their sessions", async () => {
      const user = await createUser();
      const { session } = await createSessionForUser(user.id);

      const result = await suspendUser(user.public_id);

      expect(result.status).toBe(user_status.SUSPENDED);
      const stored = await prisma.sessions.findUnique({ where: { id: session.id } });
      expect(stored?.revoked_at).not.toBeNull();
    });

    it("throws 400 when the user is already suspended", async () => {
      const user = await createUser({ status: user_status.SUSPENDED });

      await expect(suspendUser(user.public_id)).rejects.toBeInstanceOf(BadRequestError);
    });

    it("throws 404 for an unknown user", async () => {
      await expect(suspendUser("usr_does_not_exist")).rejects.toBeInstanceOf(
        NotFoundError,
      );
    });
  });

  describe("activateUser", () => {
    it("activates a suspended customer", async () => {
      const user = await createUser({ status: user_status.SUSPENDED });

      const result = await activateUser(user.public_id);

      expect(result.status).toBe(user_status.ACTIVE);
    });

    it("throws 400 when the user is already active", async () => {
      const user = await createUser();

      await expect(activateUser(user.public_id)).rejects.toBeInstanceOf(
        BadRequestError,
      );
    });
  });

  describe("changeUserRole", () => {
    it("promotes a customer to admin (super admin actor)", async () => {
      const actor = await createUser({ role: user_role.SUPER_ADMIN });
      const customer = await createUser();

      const result = await changeUserRole(
        { id: actor.id, role: actor.role },
        customer.public_id,
        { role: user_role.ADMIN },
      );

      expect(result.public_id).toBe(customer.public_id);
      expect(result.role).toBe(user_role.ADMIN);
    });

    it("demotes an admin to customer when another admin remains", async () => {
      vi.spyOn(usersRepository, "countAdmins").mockResolvedValue(2);
      const actor = await createUser({ role: user_role.SUPER_ADMIN });
      const admin = await createUser({ role: user_role.ADMIN });

      const result = await changeUserRole(
        { id: actor.id, role: actor.role },
        admin.public_id,
        { role: user_role.CUSTOMER },
      );

      expect(result.role).toBe(user_role.CUSTOMER);
    });

    it("throws 403 when a regular admin attempts a role change", async () => {
      const actor = await createUser({ role: user_role.ADMIN });
      const customer = await createUser();

      await expect(
        changeUserRole({ id: actor.id, role: actor.role }, customer.public_id, {
          role: user_role.ADMIN,
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("throws 403 when a regular admin attempts to demote the super admin", async () => {
      const actor = await createUser({ role: user_role.ADMIN });
      const superAdmin = await createUser({ role: user_role.SUPER_ADMIN });

      await expect(
        changeUserRole({ id: actor.id, role: actor.role }, superAdmin.public_id, {
          role: user_role.CUSTOMER,
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("throws 403 when targeting the super admin even from another super admin", async () => {
      const actor = await createUser({ role: user_role.SUPER_ADMIN });
      const target = await createUser({ role: user_role.SUPER_ADMIN });

      await expect(
        changeUserRole({ id: actor.id, role: actor.role }, target.public_id, {
          role: user_role.CUSTOMER,
        }),
      ).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("throws 404 for an unknown user", async () => {
      const actor = await createUser({ role: user_role.SUPER_ADMIN });

      await expect(
        changeUserRole({ id: actor.id, role: actor.role }, "usr_does_not_exist", {
          role: user_role.ADMIN,
        }),
      ).rejects.toBeInstanceOf(NotFoundError);
    });

    it("throws 400 when an admin changes their own role", async () => {
      const actor = await createUser({ role: user_role.SUPER_ADMIN });

      await expect(
        changeUserRole({ id: actor.id, role: actor.role }, actor.public_id, {
          role: user_role.CUSTOMER,
        }),
      ).rejects.toBeInstanceOf(BadRequestError);
    });

    it("returns the current role unchanged when it already matches", async () => {
      const actor = await createUser({ role: user_role.SUPER_ADMIN });
      const admin = await createUser({ role: user_role.ADMIN });

      const result = await changeUserRole(
        { id: actor.id, role: actor.role },
        admin.public_id,
        { role: user_role.ADMIN },
      );

      expect(result.role).toBe(user_role.ADMIN);
    });

    it("throws 409 when the target is the only administrator", async () => {
      vi.spyOn(usersRepository, "countAdmins").mockResolvedValue(1);
      const actor = await createUser({ role: user_role.SUPER_ADMIN });
      const soleAdmin = await createUser({ role: user_role.ADMIN });

      await expect(
        changeUserRole({ id: actor.id, role: actor.role }, soleAdmin.public_id, {
          role: user_role.CUSTOMER,
        }),
      ).rejects.toBeInstanceOf(ConflictError);
    });

    it("does not modify the role when the last-admin guard rejects", async () => {
      vi.spyOn(usersRepository, "countAdmins").mockResolvedValue(1);
      const actor = await createUser({ role: user_role.SUPER_ADMIN });
      const soleAdmin = await createUser({ role: user_role.ADMIN });

      await expect(
        changeUserRole({ id: actor.id, role: actor.role }, soleAdmin.public_id, {
          role: user_role.CUSTOMER,
        }),
      ).rejects.toBeInstanceOf(ConflictError);

      const stored = await prisma.users.findUnique({ where: { id: soleAdmin.id } });
      expect(stored?.role).toBe(user_role.ADMIN);
    });
  });
});
