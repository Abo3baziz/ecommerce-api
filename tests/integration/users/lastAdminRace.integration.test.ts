import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { changeUserRole } from "../../../src/modules/users/service/admin.service.js";
import { usersRepository } from "../../../src/modules/users/repository/users.repository.js";
import { ConflictError } from "../../../src/shared/errors/ConflictError.js";
import { prisma } from "../../../src/config/database.js";
import { user_role } from "../../../src/generated/prisma/enums.js";
import { createUser } from "../../factories/user.factory.js";
import { cleanupTestData } from "../../helpers/db.js";

vi.mock("../../../src/shared/mailer/index.js", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

function actorOf(user: { id: number; role: user_role }) {
  return { id: user.id, role: user.role };
}

type RoleLookup = typeof usersRepository.findUserRoleByPublicId;

/**
 * Forces both concurrent callers to finish their pre-transaction read before
 * either may proceed, so the race is deterministic instead of timing-dependent.
 */
async function gateOnConcurrentLookups(): Promise<void> {
  let arrived = 0;
  let releaseAll!: () => void;
  const allArrived = new Promise<void>((resolve) => {
    releaseAll = resolve;
  });

  const original = usersRepository.findUserRoleByPublicId.bind(usersRepository);

  const gatedLookup = async (
    publicId: string,
    _client?: unknown,
  ): Promise<{ id: number; public_id: string; role: user_role } | null> => {
    arrived += 1;
    if (arrived === 2) {
      releaseAll();
    }
    await allArrived;
    return original(publicId);
  };

  vi.spyOn(usersRepository, "findUserRoleByPublicId").mockImplementation(
    gatedLookup as RoleLookup,
  );
}

describe("changeUserRole last-admin race safety", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("serializes a concurrent double-demotion of the last regular admin so the loser gets 409 and the role flips once", async () => {
    const baseline = await usersRepository.countAdmins();

    const superAdmin = await createUser({ role: user_role.SUPER_ADMIN });
    const admin = await createUser({ role: user_role.ADMIN });

    await gateOnConcurrentLookups();

    const results = await Promise.allSettled([
      changeUserRole(actorOf(superAdmin), admin.public_id, {
        role: user_role.CUSTOMER,
      }),
      changeUserRole(actorOf(superAdmin), admin.public_id, {
        role: user_role.CUSTOMER,
      }),
    ]);

    const conflicts = results.filter(
      (r) => r.status === "rejected" && r.reason instanceof ConflictError,
    );

    expect(conflicts).toHaveLength(1);

    // The demoted admin loses privilege; the acting super admin remains.
    expect(await usersRepository.countAdmins()).toBe(baseline + 1);

    const stored = await prisma.users.findUnique({ where: { id: admin.id } });
    expect(stored!.role).toBe(user_role.CUSTOMER);
  });

  it("stays stable across repeated concurrent double-demotions", async () => {
    for (let round = 0; round < 5; round += 1) {
      vi.restoreAllMocks();

      const baseline = await usersRepository.countAdmins();
      const superAdmin = await createUser({ role: user_role.SUPER_ADMIN });
      const admin = await createUser({ role: user_role.ADMIN });

      await gateOnConcurrentLookups();

      const results = await Promise.allSettled([
        changeUserRole(actorOf(superAdmin), admin.public_id, {
          role: user_role.CUSTOMER,
        }),
        changeUserRole(actorOf(superAdmin), admin.public_id, {
          role: user_role.CUSTOMER,
        }),
      ]);

      expect(
        results.filter(
          (r) => r.status === "rejected" && r.reason instanceof ConflictError,
        ),
      ).toHaveLength(1);
      expect(await usersRepository.countAdmins()).toBe(baseline + 1);

      const stored = await prisma.users.findUnique({ where: { id: admin.id } });
      expect(stored!.role).toBe(user_role.CUSTOMER);

      await cleanupTestData();
    }
  });

  it("keeps at least the pre-existing privileged accounts invariant when distinct regular admins are demoted concurrently", async () => {
    const baseline = await usersRepository.countAdmins();

    const superAdmin = await createUser({ role: user_role.SUPER_ADMIN });
    const adminA = await createUser({ role: user_role.ADMIN });
    const adminB = await createUser({ role: user_role.ADMIN });

    const results = await Promise.allSettled([
      changeUserRole(actorOf(superAdmin), adminA.public_id, {
        role: user_role.CUSTOMER,
      }),
      changeUserRole(actorOf(superAdmin), adminB.public_id, {
        role: user_role.CUSTOMER,
      }),
    ]);

    for (const result of results) {
      expect(result.status).toBe("fulfilled");
    }

    // Both regular admins were demoted; the acting super admin remains on
    // top of whatever privileged accounts pre-existed in the environment.
    expect(await usersRepository.countAdmins()).toBe(baseline + 1);

    const storedA = await prisma.users.findUnique({ where: { id: adminA.id } });
    const storedB = await prisma.users.findUnique({ where: { id: adminB.id } });
    expect(storedA!.role).toBe(user_role.CUSTOMER);
    expect(storedB!.role).toBe(user_role.CUSTOMER);
  });

  it("demotes the last remaining regular admin while permanent privileged accounts (super admin) keep the system above zero", async () => {
    const superAdmin = await createUser({ role: user_role.SUPER_ADMIN });
    const admin = await createUser({ role: user_role.ADMIN });

    await expect(
      changeUserRole(actorOf(superAdmin), admin.public_id, {
        role: user_role.CUSTOMER,
      }),
    ).resolves.toMatchObject({ role: user_role.CUSTOMER });

    const stored = await prisma.users.findUnique({ where: { id: admin.id } });
    expect(stored!.role).toBe(user_role.CUSTOMER);
  });
});
