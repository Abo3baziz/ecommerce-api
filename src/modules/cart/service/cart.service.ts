import { prisma } from "../../../config/database.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { BadRequestError } from "../../../shared/errors/BadRequestError.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import {
  computeFinalPrice,
  decimalToFixed,
} from "../../products/utils/format.js";
import {
  cartRepository,
  type CartWithLinesRow,
} from "../repository/cart.repository.js";
import { MAX_CART_ITEM_QUANTITY } from "../validators/cart.js";
import type {
  AddCartItemInput,
  CartLineItemResult,
  CartResult,
  UpdateCartItemInput,
} from "../dto/cart.js";

function resolveLineImage(
  variant: CartWithLinesRow["cart_items"][number]["product_variants"],
): string | null {
  const variantImage = variant.product_variant_images[0];
  if (variantImage) {
    return variantImage.image_url;
  }

  const primaryProductImage = variant.products.product_images[0];
  return primaryProductImage ? primaryProductImage.image_url : null;
}

function toCartResult(row: CartWithLinesRow): CartResult {
  const items: CartLineItemResult[] = row.cart_items.map((line) => {
    const variant = line.product_variants;
    const product = variant.products;
    const finalPrice = computeFinalPrice(
      variant.price,
      variant.discount_percentage,
    );

    return {
      variant_public_id: variant.public_id,
      product_public_id: product.public_id,
      product_name: product.name,
      product_slug: product.slug,
      sku: variant.sku,
      color: variant.color,
      size: variant.size,
      image_url: resolveLineImage(variant),
      price: variant.price.toFixed(2),
      discount_percentage: decimalToFixed(variant.discount_percentage),
      final_price: finalPrice,
      quantity: line.quantity,
      line_total: new Prisma.Decimal(finalPrice).mul(line.quantity).toFixed(2),
      created_at: line.created_at,
      updated_at: line.updated_at,
    };
  });

  const subtotal = items.reduce(
    (acc, item) => acc.plus(item.line_total),
    new Prisma.Decimal(0),
  );

  return {
    public_id: row.public_id,
    items_count: items.length,
    total_quantity: items.reduce((acc, item) => acc + item.quantity, 0),
    subtotal: subtotal.toFixed(2),
    items,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getCart(userId: number): Promise<CartResult> {
  const row = await cartRepository.findCartWithLinesByUserId(userId);

  if (!row) {
    throw new NotFoundError("Cart not found for this user");
  }

  return toCartResult(row);
}

async function withUserCartLock<T>(
  userId: number,
  run: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(${userId})) AS lock`;
    return run(tx);
  });
}

export async function addCartItem(
  userId: number,
  input: AddCartItemInput,
): Promise<CartResult> {
  const variant = await cartRepository.findActiveVariantIdByPublicId(
    input.variant_public_id,
  );

  if (!variant) {
    throw new NotFoundError("Variant not found");
  }

  const cart = await withUserCartLock(userId, async (tx) => {
    let cartId = (await cartRepository.findCartIdByUserId(userId, tx))?.id;
    if (cartId === undefined) {
      cartId = (await cartRepository.createCart(userId, tx)).id;
    }

    const existingLine = await cartRepository.findCartLineByVariantId(
      cartId,
      variant.id,
      tx,
    );

    if (existingLine) {
      const mergedQuantity = existingLine.quantity + input.quantity;
      if (mergedQuantity > MAX_CART_ITEM_QUANTITY) {
        throw new BadRequestError(
          `Adding this quantity would exceed the maximum of ${MAX_CART_ITEM_QUANTITY} per item`,
        );
      }
      await cartRepository.incrementLineQuantity(
        cartId,
        variant.id,
        input.quantity,
        tx,
      );
    } else {
      await cartRepository.createCartLine(cartId, variant.id, input.quantity, tx);
    }

    const row = await cartRepository.findCartWithLinesByCartId(cartId, tx);
    return row!;
  });

  return toCartResult(cart);
}

export async function updateCartItemQuantity(
  userId: number,
  variantPublicId: string,
  input: UpdateCartItemInput,
): Promise<CartResult> {
  return withUserCartLock(userId, async (tx) => {
    const cart = await cartRepository.findCartIdByUserId(userId, tx);

    if (!cart) {
      throw new NotFoundError("Cart not found for this user");
    }

    const line = await cartRepository.findCartLineByVariantPublicId(
      cart.id,
      variantPublicId,
      tx,
    );

    if (!line) {
      throw new NotFoundError(`Variant ${variantPublicId} is not in the cart`);
    }

    await cartRepository.updateLineQuantity(
      cart.id,
      line.product_variants_id,
      input.quantity,
      tx,
    );

    const row = await cartRepository.findCartWithLinesByCartId(cart.id, tx);

    if (!row) {
      throw new NotFoundError("Cart not found for this user");
    }

    return toCartResult(row);
  });
}

export async function removeCartItem(
  userId: number,
  variantPublicId: string,
): Promise<void> {
  return withUserCartLock(userId, async (tx) => {
    const cart = await cartRepository.findCartIdByUserId(userId, tx);

    if (!cart) {
      throw new NotFoundError("Cart not found for this user");
    }

    const line = await cartRepository.findCartLineByVariantPublicId(
      cart.id,
      variantPublicId,
      tx,
    );

    if (!line) {
      throw new NotFoundError(`Variant ${variantPublicId} is not in the cart`);
    }

    await cartRepository.deleteCartLine(cart.id, line.product_variants_id, tx);
  });
}

export async function clearCart(userId: number): Promise<void> {
  return withUserCartLock(userId, async (tx) => {
    const cart = await cartRepository.findCartIdByUserId(userId, tx);

    if (!cart) {
      throw new NotFoundError("Cart not found for this user");
    }

    await cartRepository.deleteCartLines(cart.id, tx);
    await cartRepository.deleteCart(cart.id, tx);
  });
}
