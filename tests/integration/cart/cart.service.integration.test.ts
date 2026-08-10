import { describe, it, expect, beforeEach } from "vitest";
import {
  addCartItem,
  clearCart,
  getCart,
  removeCartItem,
  updateCartItemQuantity,
} from "../../../src/modules/cart/service/cart.service.js";
import { BadRequestError } from "../../../src/shared/errors/BadRequestError.js";
import { NotFoundError } from "../../../src/shared/errors/NotFoundError.js";
import { product_status } from "../../../src/generated/prisma/enums.js";
import { prisma } from "../../../src/config/database.js";
import { createUser } from "../../factories/user.factory.js";
import { createProduct } from "../../factories/product.factory.js";
import { createVariant } from "../../factories/variant.factory.js";
import { createProductImage } from "../../factories/product-image.factory.js";
import { createVariantImage } from "../../factories/variant-image.factory.js";
import { createCart, createCartItem } from "../../factories/cart.factory.js";
import { cleanupTestData } from "../../helpers/db.js";

describe("cart.service", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  async function createUserWithCart() {
    const user = await createUser();
    const product = await createProduct({ name: "Wireless Headphones" });
    const variant = await createVariant(product.id, {
      sku: "WH-1000",
      price: "129.99",
      discount_percentage: "10.00",
    });
    const cart = await createCart(user.id);
    await createCartItem(cart.id, variant.id, 3);
    return { user, product, variant, cart };
  }

  describe("getCart", () => {
    it("throws NotFoundError when the user has no cart", async () => {
      const user = await createUser();

      await expect(getCart(user.id)).rejects.toThrow(NotFoundError);
    });

    it("returns an empty cart row with zeroed totals", async () => {
      const user = await createUser();
      await createCart(user.id);

      const result = await getCart(user.id);

      expect(result.items_count).toBe(0);
      expect(result.total_quantity).toBe(0);
      expect(result.subtotal).toBe("0.00");
      expect(result.items).toEqual([]);
      expect(result).not.toHaveProperty("id");
      expect(result).not.toHaveProperty("users_id");
    });

    it("computes derived line fields and cart totals from live pricing", async () => {
      const { user, variant, cart } = await createUserWithCart();

      const result = await getCart(user.id);

      expect(result.public_id).toBe(cart.public_id);
      expect(result.items_count).toBe(1);
      expect(result.total_quantity).toBe(3);
      expect(result.subtotal).toBe("350.97");
      expect(result.items).toHaveLength(1);

      const line = result.items[0];
      expect(line.variant_public_id).toBe(variant.public_id);
      expect(line.product_public_id).toBe(await getProductPublicId(variant));
      expect(line.product_name).toBe("Wireless Headphones");
      expect(line.sku).toBe("WH-1000");
      expect(line.price).toBe("129.99");
      expect(line.discount_percentage).toBe("10.00");
      expect(line.final_price).toBe("116.99");
      expect(line.quantity).toBe(3);
      expect(line.line_total).toBe("350.97");
      expect(line).not.toHaveProperty("id");
      expect(line).not.toHaveProperty("carts_id");
      expect(line).not.toHaveProperty("product_variants_id");
    });

    it("prefers the first variant image over the product primary image", async () => {
      const { user, variant, product } = await createUserWithCart();
      await createProductImage(product.id, { is_primary: true, image_url: "https://ik.imagekit.io/ecommerceImages/primary.jpg" });
      await createVariantImage(variant.id, { display_order: 0, image_url: "https://ik.imagekit.io/ecommerceImages/variant.jpg" });
      await createVariantImage(variant.id, { display_order: 1, image_url: "https://ik.imagekit.io/ecommerceImages/variant-second.jpg" });

      const result = await getCart(user.id);

      expect(result.items[0].image_url).toBe("https://ik.imagekit.io/ecommerceImages/variant.jpg");
    });

    it("falls back to the product primary image when the variant has none", async () => {
      const { user, product } = await createUserWithCart();
      await createProductImage(product.id, { is_primary: true, image_url: "https://ik.imagekit.io/ecommerceImages/primary.jpg" });

      const result = await getCart(user.id);

      expect(result.items[0].image_url).toBe("https://ik.imagekit.io/ecommerceImages/primary.jpg");
    });

    it("returns null image_url when no images exist", async () => {
      const { user } = await createUserWithCart();

      const result = await getCart(user.id);

      expect(result.items[0].image_url).toBeNull();
    });

    it("returns lines in insertion order", async () => {
      const user = await createUser();
      const product = await createProduct();
      const first = await createVariant(product.id, { sku: "FIRST-1", price: "10.00" });
      const second = await createVariant(product.id, { sku: "SECOND-1", price: "20.00" });
      const cart = await createCart(user.id);
      await createCartItem(cart.id, first.id, 1);
      await createCartItem(cart.id, second.id, 1);

      const result = await getCart(user.id);

      expect(result.items.map((item) => item.sku)).toEqual(["FIRST-1", "SECOND-1"]);
      expect(result.subtotal).toBe("30.00");
      expect(result.items_count).toBe(2);
      expect(result.total_quantity).toBe(2);
    });
  });

  describe("addCartItem", () => {
    it("creates the cart lazily on the first add", async () => {
      const user = await createUser();
      const product = await createProduct({ name: "Wireless Headphones" });
      const variant = await createVariant(product.id, { sku: "WH-1000", price: "129.99" });

      const result = await addCartItem(user.id, {
        variant_public_id: variant.public_id,
        quantity: 2,
      });

      expect(result.items_count).toBe(1);
      expect(result.total_quantity).toBe(2);
      expect(result.subtotal).toBe("259.98");
      expect(result.items[0].sku).toBe("WH-1000");
      expect(result.items[0].quantity).toBe(2);

      const carts = await prisma.carts.findMany({ where: { users_id: user.id } });
      expect(carts).toHaveLength(1);
    });

    it("increments an existing line instead of duplicating it (merge-on-add)", async () => {
      const user = await createUser();
      const product = await createProduct();
      const variant = await createVariant(product.id, { price: "10.00" });

      await addCartItem(user.id, { variant_public_id: variant.public_id, quantity: 2 });
      const result = await addCartItem(user.id, { variant_public_id: variant.public_id, quantity: 3 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].quantity).toBe(5);
      expect(result.total_quantity).toBe(5);
      expect(result.subtotal).toBe("50.00");

      const stored = await prisma.cart_items.findMany({
        where: { carts: { users_id: user.id } },
      });
      expect(stored).toHaveLength(1);
      expect(stored[0].quantity).toBe(5);
    });

    it("adds a second distinct variant as a new line", async () => {
      const user = await createUser();
      const product = await createProduct();
      const first = await createVariant(product.id, { sku: "FIRST-1", price: "10.00" });
      const second = await createVariant(product.id, { sku: "SECOND-1", price: "20.00" });

      await addCartItem(user.id, { variant_public_id: first.public_id, quantity: 1 });
      const result = await addCartItem(user.id, { variant_public_id: second.public_id, quantity: 1 });

      expect(result.items_count).toBe(2);
      expect(result.subtotal).toBe("30.00");
    });

    it("returns 400 when the merge would exceed the maximum quantity", async () => {
      const user = await createUser();
      const product = await createProduct();
      const variant = await createVariant(product.id);

      await addCartItem(user.id, { variant_public_id: variant.public_id, quantity: 999 });

      await expect(
        addCartItem(user.id, { variant_public_id: variant.public_id, quantity: 1 }),
      ).rejects.toThrow(BadRequestError);

      const stored = await prisma.cart_items.findMany({
        where: { carts: { users_id: user.id } },
      });
      expect(stored).toHaveLength(1);
      expect(stored[0].quantity).toBe(999);
    });

    it("throws NotFoundError for an unknown variant", async () => {
      const user = await createUser();

      await expect(
        addCartItem(user.id, { variant_public_id: "var_unknown" }),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for a soft-deleted variant", async () => {
      const user = await createUser();
      const product = await createProduct();
      const variant = await createVariant(product.id, { deleted_at: new Date() });

      await expect(
        addCartItem(user.id, { variant_public_id: variant.public_id }),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for a non-ACTIVE variant", async () => {
      const user = await createUser();
      const product = await createProduct();
      const variant = await createVariant(product.id, { status: product_status.DRAFT });

      await expect(
        addCartItem(user.id, { variant_public_id: variant.public_id }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("updateCartItemQuantity", () => {
    it("sets the absolute quantity", async () => {
      const { user, variant } = await createUserWithCart();

      const result = await updateCartItemQuantity(user.id, variant.public_id, {
        quantity: 4,
      });

      expect(result.items[0].quantity).toBe(4);
      expect(result.total_quantity).toBe(4);
      expect(result.subtotal).toBe("467.96");
    });

    it("is idempotent when the same quantity is sent", async () => {
      const { user, variant } = await createUserWithCart();

      const result = await updateCartItemQuantity(user.id, variant.public_id, {
        quantity: 3,
      });

      expect(result.items[0].quantity).toBe(3);
    });

    it("throws NotFoundError when the user has no cart", async () => {
      const user = await createUser();
      const product = await createProduct();
      const variant = await createVariant(product.id);

      await expect(
        updateCartItemQuantity(user.id, variant.public_id, { quantity: 1 }),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError when the variant is not in the cart", async () => {
      const user = await createUser();
      const product = await createProduct();
      const cartVariant = await createVariant(product.id, { sku: "IN-CART" });
      const otherVariant = await createVariant(product.id, { sku: "NOT-IN-CART" });
      const cart = await createCart(user.id);
      await createCartItem(cart.id, cartVariant.id, 1);

      await expect(
        updateCartItemQuantity(user.id, otherVariant.public_id, { quantity: 2 }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("removeCartItem", () => {
    it("removes the line and preserves the cart row", async () => {
      const { user, variant } = await createUserWithCart();

      await removeCartItem(user.id, variant.public_id);

      const emptyCart = await getCart(user.id);
      expect(emptyCart.items).toEqual([]);
      expect(emptyCart.items_count).toBe(0);
      expect(emptyCart.subtotal).toBe("0.00");

      const stored = await prisma.cart_items.findMany({
        where: { carts: { users_id: user.id } },
      });
      expect(stored).toHaveLength(0);
    });

    it("throws NotFoundError when the user has no cart", async () => {
      const user = await createUser();
      const product = await createProduct();
      const variant = await createVariant(product.id);

      await expect(
        removeCartItem(user.id, variant.public_id),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError when the variant is not in the cart", async () => {
      const { user, product } = await createUserWithCart();
      const otherVariant = await createVariant(product.id, { sku: "NOT-IN-CART" });

      await expect(
        removeCartItem(user.id, otherVariant.public_id),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("clearCart", () => {
    it("deletes the cart and all of its lines", async () => {
      const { user, variant } = await createUserWithCart();

      await clearCart(user.id);

      const carts = await prisma.carts.findMany({ where: { users_id: user.id } });
      const items = await prisma.cart_items.findMany({
        where: { carts: { users_id: user.id } },
      });
      expect(carts).toHaveLength(0);
      expect(items).toHaveLength(0);

      await expect(getCart(user.id)).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError when the user has no cart", async () => {
      const user = await createUser();

      await expect(clearCart(user.id)).rejects.toThrow(NotFoundError);
    });
  });
});

async function getProductPublicId(
  variant: { products_id: number },
): Promise<string> {
  const product = await prisma.products.findUnique({
    where: { id: variant.products_id },
    select: { public_id: true },
  });
  return product!.public_id;
}
