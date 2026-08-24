import { describe, it, expect, beforeEach } from "vitest";
import { nanoid } from "nanoid";
import { transferSuperAdmin } from "../../../scripts/transfer-super-admin.js";
import { prisma } from "../../../src/config/database.js";
import { user_role } from "../../../src/generated/prisma/enums.js";
import { createUser } from "../../factories/user.factory.js";
import { cleanupTestData } from "../../helpers/db.js";

function testEmail(): string {
  return `test-${nanoid(8)}@example.com`;
}

describe("super-admin transfer CLI", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  it("transfers the role atomically: successor becomes SUPER_ADMIN, previous becomes ADMIN", async () => {
    const current = await createUser({ role: user_role.SUPER_ADMIN });
    const successor = await createUser({ role: user_role.ADMIN });

    const result = await transferSuperAdmin(current.email, successor.email);

    expect(result.status).toBe("transferred");

    const updatedCurrent = await prisma.users.findUnique({
      where: { id: current.id },
      select: { role: true },
    });
    const updatedSuccessor = await prisma.users.findUnique({
      where: { id: successor.id },
      select: { role: true },
    });
    expect(updatedCurrent?.role).toBe(user_role.ADMIN);
    expect(updatedSuccessor?.role).toBe(user_role.SUPER_ADMIN);

    // Exactly one super admin remains.
    const superAdmins = await prisma.users.count({
      where: { role: user_role.SUPER_ADMIN, deleted_at: null },
    });
    expect(superAdmins).toBe(1);
  });

  it("writes a transactional audit record for the transfer", async () => {
    const current = await createUser({ role: user_role.SUPER_ADMIN });
    const successor = await createUser({ role: user_role.ADMIN });

    await transferSuperAdmin(current.email, successor.email);

    const audit = await prisma.audit_logs.findFirst({
      where: { action: "auth.super_admin.transferred" },
      orderBy: { created_at: "desc" },
    });
    expect(audit).not.toBeNull();
    expect(audit!.actor_users_id).toBe(current.id);
  });

  it("refuses when the current email is not a SUPER_ADMIN", async () => {
    const plainAdmin = await createUser({ role: user_role.ADMIN });
    const successor = await createUser({ role: user_role.ADMIN });

    const result = await transferSuperAdmin(plainAdmin.email, successor.email);

    expect(result.status).toBe("current_not_super_admin");

    const untouched = await prisma.users.findUnique({
      where: { id: successor.id },
      select: { role: true },
    });
    expect(untouched?.role).toBe(user_role.ADMIN);
  });

  it("refuses an unknown successor without changes", async () => {
    const current = await createUser({ role: user_role.SUPER_ADMIN });

    const result = await transferSuperAdmin(current.email, testEmail());

    expect(result.status).toBe("missing_successor");
    const unchanged = await prisma.users.findUnique({
      where: { id: current.id },
      select: { role: true },
    });
    expect(unchanged?.role).toBe(user_role.SUPER_ADMIN);
  });
});
