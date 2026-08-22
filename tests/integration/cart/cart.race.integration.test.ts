import { describe, it, expect, beforeEach } from "vitest";
import { nanoid } from "nanoid";
import {
  placeOrder,
} from "../../../src/modules/orders/service/orders.service.js";
import {
  clearCart,
  removeCartItem,
  updateCartItemQuantity,
} from "../../../src/modules/cart/service/cart.service.js";
import { AppError } from "../../../src/shared/errors/AppError.js";
import { NotFoundError } from "../../../src/shared/errors/NotFoundError.js";
import { prisma } from "../../../src/config/database.js";
import { cleanupTestData } from "../../helpers/db.js";
import { createUser } from "../../factories/user.factory.js";
import { createProduct } from "../../factories/product.factory.js";
import { createVariant } from "../../factories/variant.factory.js";
import { createInventory } from "../../factories/inventory.factory.js";
import { createCart, createCartItem } from "../../factories/cart.factory.js";
import { createAddress } from "../../factories/address.factory.js";

describe("cart mutation races", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  interface CheckoutContext {
    user: { id: number };
    address: { public_id: string };
    variant: { id: number; public_id: string };
  }

  async function createCheckoutContext(): Promise<CheckoutContext> {
    const user = await createUser();
    const address = await createAddress(user.id);
    const product = await createProduct();
    const variant = await createVariant(product.id, {
      sku: `SKU-${nanoid(8)}`,
      price: "100.00",
      discount_percentage: "0.00",
    });
    await createInventory(variant.id, { quantity_on_hand: 100 });
    const cart = await createCart(user.id);
    await createCartItem(cart.id, variant.id, 1);
    return { user, address, variant };
  }

  function rejectionOf(
    settled: PromiseSettledResult<unknown>,
  ): unknown | null {
    return settled.status === "rejected" ? settled.reason : null;
  }

  function expectNoUnexpectedRejection(settled: PromiseSettledResult<unknown>) {
    const reason = rejectionOf(settled);

    if (reason !== null) {
      expect(reason).toBeInstanceOf(AppError);
    }
  }

  it("serializes checkout against clearCart so exactly one side succeeds", async () => {
    for (let round = 0; round < 4; round += 1) {
      const { user, address } = await createCheckoutContext();

      const [checkout, clear] = await Promise.allSettled([
        placeOrder(user.id, {
          address_public_id: address.public_id,
          payment_method: "mock",
        }),
        clearCart(user.id),
      ]);

      expectNoUnexpectedRejection(checkout);
      expectNoUnexpectedRejection(clear);

      const fulfilledCount = [checkout, clear].filter(
        (outcome) => outcome.status === "fulfilled",
      ).length;

      expect(fulfilledCount).toBe(1);

      const orderCount = await prisma.orders.count({
        where: { users_id: user.id },
      });

      if (checkout.status === "fulfilled") {
        expect(orderCount).toBe(1);
        const clearReason = rejectionOf(clear);
        expect(clearReason).toBeInstanceOf(NotFoundError);
      } else {
        expect(orderCount).toBe(0);
        const checkoutReason = rejectionOf(checkout);
        expect(checkoutReason).toBeInstanceOf(NotFoundError);
      }
    }
  });

  it("serializes checkout against updateCartItemQuantity without 500s", async () => {
    for (let round = 0; round < 4; round += 1) {
      const { user, address, variant } = await createCheckoutContext();

      const [checkout, update] = await Promise.allSettled([
        placeOrder(user.id, {
          address_public_id: address.public_id,
          payment_method: "mock",
        }),
        updateCartItemQuantity(user.id, variant.public_id, { quantity: 4 }),
      ]);

      expectNoUnexpectedRejection(checkout);
      expectNoUnexpectedRejection(update);

      const order = await prisma.orders.findFirst({
        where: { users_id: user.id },
        include: { order_items: true },
      });

      expect(order).not.toBeNull();

      if (update.status === "fulfilled") {
        expect(update.value.subtotal).toBe("400.00");
        expect(order!.order_items[0].quantity).toBe(4);
        expect(order!.total_amount.toFixed(2)).toBe("410.00");
      } else {
        expect(rejectionOf(update)).toBeInstanceOf(NotFoundError);
        expect(order!.total_amount.toFixed(2)).toBe("110.00");
        expect(order!.order_items[0].quantity).toBe(1);
      }
    }
  });

  it("resolves concurrent duplicate line removals to one success and one clean 404", async () => {
    const { user, variant } = await createCheckoutContext();

    const [first, second] = await Promise.allSettled([
      removeCartItem(user.id, variant.public_id),
      removeCartItem(user.id, variant.public_id),
    ]);

    expectNoUnexpectedRejection(first);
    expectNoUnexpectedRejection(second);

    const fulfilledCount = [first, second].filter(
      (outcome) => outcome.status === "fulfilled",
    ).length;

    expect(fulfilledCount).toBe(1);

    const loser = [first, second].find(
      (outcome) => outcome.status === "rejected",
    ) as PromiseRejectedResult;
    expect(loser.reason).toBeInstanceOf(NotFoundError);

    const lineCount = await prisma.cart_items.count();
    expect(lineCount).toBe(0);
  });
});
