import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { nanoid } from "nanoid";
import {
  promoteUserToAdmin,
  runAdminCreate,
} from "../../../scripts/create-admin.js";
import { prisma } from "../../../src/config/database.js";
import { user_role } from "../../../src/generated/prisma/enums.js";
import { createUser, TEST_PASSWORD } from "../../factories/user.factory.js";
import { cleanupTestData } from "../../helpers/db.js";

function testEmail(): string {
  return `test-${nanoid(8)}@example.com`;
}

describe("admin bootstrap CLI", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("runAdminCreate", () => {
    it("promotes an existing non-admin user and reports success", async () => {
      const user = await createUser({ role: user_role.CUSTOMER });

      const outcome = await runAdminCreate(user.email);

      expect(outcome.exitCode).toBe(0);
      expect(outcome.messages).toContain("User found.");
      expect(outcome.messages).toContain("Current role: CUSTOMER");
      expect(outcome.messages).toContain("User successfully promoted to ADMIN.");

      const updated = await prisma.users.findUnique({
        where: { id: user.id },
        select: { role: true },
      });
      expect(updated?.role).toBe(user_role.ADMIN);
    });

    it("reports no change when the user is already an admin", async () => {
      const user = await createUser({ role: user_role.ADMIN });

      const outcome = await runAdminCreate(user.email);

      expect(outcome.exitCode).toBe(0);
      expect(outcome.messages).toContain("User is already an ADMIN.");
      expect(outcome.messages).toContain("No changes were made.");

      const updated = await prisma.users.findUnique({
        where: { id: user.id },
        select: { role: true },
      });
      expect(updated?.role).toBe(user_role.ADMIN);
    });

    it("fails cleanly for a non-existent user", async () => {
      const outcome = await runAdminCreate(testEmail());

      expect(outcome.exitCode).toBe(1);
      expect(outcome.messages).toContain(
        "No user found with the provided email.",
      );
      expect(outcome.messages).toContain("No changes were made.");
    });

    it("fails cleanly for empty email input", async () => {
      const outcome = await runAdminCreate("   ");

      expect(outcome.exitCode).toBe(1);
      expect(outcome.messages).toContain("Error: email is required.");
    });

    it("fails cleanly for invalid email format", async () => {
      const outcome = await runAdminCreate("not-an-email");

      expect(outcome.exitCode).toBe(1);
      expect(outcome.messages).toContain("Error: invalid email format.");
      expect(outcome.messages).toContain("No changes were made.");
    });

    it("handles database errors and never leaks sensitive information", async () => {
      const user = await createUser({ role: user_role.CUSTOMER });
      const error = new Error(
        "connection string postgresql://user:supersecret@db/password",
      );

      vi.spyOn(prisma.users, "findUnique").mockRejectedValueOnce(error);

      const outcome = await runAdminCreate(user.email);

      expect(outcome.exitCode).toBe(1);
      expect(outcome.messages).toContain(
        "An error occurred while promoting the user.",
      );
      expect(outcome.messages).not.toContain("supersecret");
      expect(outcome.messages.join("\n")).not.toContain(TEST_PASSWORD);
    });
  });

  describe("promoteUserToAdmin", () => {
    it("returns already_admin without updating for an admin user", async () => {
      const user = await createUser({ role: user_role.ADMIN });

      const result = await promoteUserToAdmin(user.email);

      expect(result).toEqual({ status: "already_admin", role: user_role.ADMIN });
    });

    it("returns not_found for an unknown user", async () => {
      const result = await promoteUserToAdmin(testEmail());

      expect(result).toEqual({ status: "not_found" });
    });
  });
});
