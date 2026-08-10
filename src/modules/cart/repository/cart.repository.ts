import { prisma } from "../../../config/database.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { product_status } from "../../../generated/prisma/enums.js";
import { PUBLIC_ID_PREFIXES } from "../../../shared/constants/index.js";
import { generatePublicId } from "../../../shared/utils/index.js";

type DbClient = Prisma.TransactionClient | typeof prisma;

const cartWithLinesSelect = {
  id: true,
  public_id: true,
  created_at: true,
  updated_at: true,
  cart_items: {
    orderBy: [
      { created_at: "asc" },
      { id: "asc" },
    ] as Prisma.cart_itemsOrderByWithRelationInput[],
    select: {
      quantity: true,
      created_at: true,
      updated_at: true,
      product_variants: {
        select: {
          public_id: true,
          sku: true,
          color: true,
          size: true,
          price: true,
          discount_percentage: true,
          products: {
            select: {
              public_id: true,
              name: true,
              slug: true,
              product_images: {
                where: { is_primary: true },
                orderBy: { display_order: "asc" as const },
                select: { image_url: true },
                take: 1,
              },
            },
          },
          product_variant_images: {
            orderBy: [
              { display_order: "asc" },
              { id: "asc" },
            ] as Prisma.product_variant_imagesOrderByWithRelationInput[],
            select: { image_url: true },
            take: 1,
          },
        },
      },
    },
  },
} as const;

export type CartWithLinesRow = Prisma.cartsGetPayload<{
  select: typeof cartWithLinesSelect;
}>;

export interface CartLineRow {
  id: number;
  quantity: number;
}

export const cartRepository = {
  findActiveVariantIdByPublicId(public_id: string) {
    return prisma.product_variants.findFirst({
      where: {
        public_id,
        deleted_at: null,
        status: product_status.ACTIVE,
      },
      select: { id: true },
    });
  },

  findCartIdByUserId(users_id: number, client: DbClient = prisma) {
    return client.carts.findFirst({
      where: { users_id },
      select: { id: true },
    });
  },

  createCart(users_id: number, client: DbClient = prisma) {
    const now = new Date();
    return client.carts.create({
      data: {
        public_id: generatePublicId(PUBLIC_ID_PREFIXES.CART),
        users_id,
        created_at: now,
        updated_at: now,
      },
      select: { id: true },
    });
  },

  findCartWithLinesByUserId(users_id: number, client: DbClient = prisma) {
    return client.carts.findFirst({
      where: { users_id },
      select: cartWithLinesSelect,
    });
  },

  findCartWithLinesByCartId(carts_id: number, client: DbClient = prisma) {
    return client.carts.findFirst({
      where: { id: carts_id },
      select: cartWithLinesSelect,
    });
  },

  findCartLineByVariantId(
    carts_id: number,
    product_variants_id: number,
    client: DbClient = prisma,
  ) {
    return client.cart_items.findFirst({
      where: { carts_id, product_variants_id },
      select: { id: true, quantity: true },
    });
  },

  findCartLineByVariantPublicId(
    carts_id: number,
    variantPublicId: string,
    client: DbClient = prisma,
  ) {
    return client.cart_items.findFirst({
      where: {
        carts_id,
        product_variants: { public_id: variantPublicId },
      },
      select: { id: true, product_variants_id: true },
    });
  },

  createCartLine(
    carts_id: number,
    product_variants_id: number,
    quantity: number,
    client: DbClient = prisma,
  ) {
    const now = new Date();
    return client.cart_items.create({
      data: {
        carts_id,
        product_variants_id,
        quantity,
        created_at: now,
        updated_at: now,
      },
    });
  },

  incrementLineQuantity(
    carts_id: number,
    product_variants_id: number,
    quantity: number,
    client: DbClient = prisma,
  ) {
    return client.cart_items.updateMany({
      where: { carts_id, product_variants_id },
      data: {
        quantity: { increment: quantity },
        updated_at: new Date(),
      },
    });
  },

  updateLineQuantity(
    carts_id: number,
    product_variants_id: number,
    quantity: number,
    client: DbClient = prisma,
  ) {
    return client.cart_items.updateMany({
      where: { carts_id, product_variants_id },
      data: {
        quantity,
        updated_at: new Date(),
      },
    });
  },

  deleteCartLine(
    carts_id: number,
    product_variants_id: number,
    client: DbClient = prisma,
  ) {
    return client.cart_items.deleteMany({
      where: { carts_id, product_variants_id },
    });
  },

  deleteCartLines(carts_id: number, client: DbClient = prisma) {
    return client.cart_items.deleteMany({
      where: { carts_id },
    });
  },

  deleteCart(carts_id: number, client: DbClient = prisma) {
    return client.carts.delete({
      where: { id: carts_id },
    });
  },
};
