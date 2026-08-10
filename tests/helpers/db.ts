import { prisma } from "../../src/config/database.js";

export async function cleanupTestData(): Promise<void> {
  const testUsers = await prisma.users.findMany({
    where: { email: { startsWith: "test-" } },
    select: { id: true },
  });

  if (testUsers.length > 0) {
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
    await prisma.cart_items.deleteMany({
      where: { carts: { users_id: { in: userIds } } },
    });
    await prisma.carts.deleteMany({
      where: { users_id: { in: userIds } },
    });
    await prisma.users.deleteMany({
      where: { id: { in: userIds } },
    });
  }

  await prisma.product_categories.deleteMany({});
  await prisma.product_variant_images.deleteMany({});
  await prisma.cart_items.deleteMany({});
  await prisma.inventory.deleteMany({});
  await prisma.product_variants.deleteMany({});
  await prisma.product_images.deleteMany({});
  await prisma.products.deleteMany({});
  await prisma.categories.deleteMany({});
}
