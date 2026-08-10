import { prisma } from "../../src/config/database.js";
import { generatePublicId } from "../../src/shared/utils/index.js";
import { PUBLIC_ID_PREFIXES } from "../../src/shared/constants/index.js";

export async function createCart(
  usersId: number,
  overrides: { created_at?: Date; updated_at?: Date } = {},
) {
  const now = new Date();

  return prisma.carts.create({
    data: {
      public_id: generatePublicId(PUBLIC_ID_PREFIXES.CART),
      users_id: usersId,
      created_at: overrides.created_at ?? now,
      updated_at: overrides.updated_at ?? now,
    },
  });
}

export async function createCartItem(
  cartsId: number,
  productVariantsId: number,
  quantity = 1,
) {
  const now = new Date();

  return prisma.cart_items.create({
    data: {
      carts_id: cartsId,
      product_variants_id: productVariantsId,
      quantity,
      created_at: now,
      updated_at: now,
    },
  });
}
