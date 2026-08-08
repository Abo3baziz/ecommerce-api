import { prisma } from "../../src/config/database.js";

export async function cleanupTestData(): Promise<void> {
  const testUsers = await prisma.users.findMany({
    where: { email: { startsWith: "test-" } },
    select: { id: true },
  });

  if (testUsers.length === 0) {
    return;
  }

  const userIds = testUsers.map((user) => user.id);

  await prisma.verification_tokens.deleteMany({
    where: { users_id: { in: userIds } },
  });
  await prisma.sessions.deleteMany({
    where: { users_id: { in: userIds } },
  });
  await prisma.user_addresses.deleteMany({
    where: { users_id: { in: userIds } },
  });
  await prisma.users.deleteMany({
    where: { id: { in: userIds } },
  });
}
