import { describe, it, expect, beforeEach } from "vitest";
import { nanoid } from "nanoid";
import { Prisma } from "../../../src/generated/prisma/client.js";
import {
  discount_type,
  order_status,
  payment_status,
  product_status,
} from "../../../src/generated/prisma/enums.js";
import {
  getOrder,
  listOrders,
  placeOrder,
} from "../../../src/modules/orders/service/orders.service.js";
import {
  getAdminOrder,
  listAdminOrders,
  updateOrderStatus,
} from "../../../src/modules/orders/service/admin.service.js";
import { ConflictError } from "../../../src/shared/errors/ConflictError.js";
import { NotFoundError } from "../../../src/shared/errors/NotFoundError.js";
import { PUBLIC_ID_PREFIXES } from "../../../src/shared/constants/index.js";
import { generatePublicId } from "../../../src/shared/utils/index.js";
import { prisma } from "../../../src/config/database.js";
import { ordersRepository } from "../../../src/modules/orders/repository/orders.repository.js";
import { cleanupTestData } from "../../helpers/db.js";
import { createUser } from "../../factories/user.factory.js";
import { createProduct } from "../../factories/product.factory.js";
import { createVariant } from "../../factories/variant.factory.js";
import { createInventory } from "../../factories/inventory.factory.js";
import { createCart, createCartItem } from "../../factories/cart.factory.js";
import { createAddress } from "../../factories/address.factory.js";
import { createCoupon } from "../../factories/coupon.factory.js";

describe("orders.service", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  interface CheckoutContext {
    user: { id: number };
    address: { public_id: string; id: number };
    product: { id: number };
    variant: { id: number; public_id: string; sku: string };
  }

  async function createCheckoutContext(
    overrides: {
      quantity?: number;
      price?: string;
      discount_percentage?: string;
      stock?: number;
      status?: product_status;
      variantDeleted?: boolean;
      productDeleted?: boolean;
      addressDeleted?: boolean;
    } = {},
  ): Promise<CheckoutContext> {
    const user = await createUser();
    const address = await createAddress(user.id, {
      deleted_at: overrides.addressDeleted ? new Date() : null,
    });
    const product = await createProduct({
      deleted_at: overrides.productDeleted ? new Date() : null,
    });
    const variant = await createVariant(product.id, {
      sku: `SKU-${nanoid(8)}`,
      price: overrides.price ?? "100.00",
      discount_percentage: overrides.discount_percentage ?? "0.00",
      status: overrides.status ?? product_status.ACTIVE,
      deleted_at: overrides.variantDeleted ? new Date() : null,
    });
    await createInventory(variant.id, {
      quantity_on_hand: overrides.stock ?? 100,
    });
    const cart = await createCart(user.id);
    await createCartItem(cart.id, variant.id, overrides.quantity ?? 1);
    return { user, address, product, variant };
  }

  async function createOrderInStatus(
    overrides: {
      status?: order_status;
      quantity?: number;
      onHand?: number;
      coupon?: Awaited<ReturnType<typeof createCoupon>>;
    } = {},
  ) {
    const user = await createUser();
    const address = await createAddress(user.id);
    const product = await createProduct();
    const variant = await createVariant(product.id, {
      sku: `SKU-${nanoid(8)}`,
      price: "100.00",
      discount_percentage: "0.00",
    });
    const onHand = overrides.onHand ?? 100;
    const quantity = overrides.quantity ?? 1;
    await createInventory(variant.id, {
      quantity_on_hand: onHand,
      quantity_reserved: 0,
    });

    const status = overrides.status ?? order_status.PENDING;
    const committed =
      status !== order_status.PENDING && status !== order_status.CANCELLED;
    const now = new Date();

    const order = await prisma.orders.create({
      data: {
        public_id: generatePublicId(PUBLIC_ID_PREFIXES.ORDER),
        order_number: `ORD-${nanoid(10)}`,
        status,
        shipping_cost: new Prisma.Decimal("10.00"),
        subtotal: new Prisma.Decimal("100.00"),
        discount_amount: new Prisma.Decimal("0.00"),
        shipping_fee: new Prisma.Decimal("10.00"),
        tax_amount: new Prisma.Decimal("0.00"),
        total_amount: new Prisma.Decimal("110.00"),
        notes: null,
        placed_at: now,
        created_at: now,
        updated_at: now,
        users_id: user.id,
        coupons_id: null,
        user_addresses_id: address.id,
      },
    });

    await prisma.order_items.create({
      data: {
        orders_id: order.id,
        product_variants_id: variant.id,
        product_name: product.name,
        product_slug: product.slug,
        sku: variant.sku,
        variant_color: variant.color,
        variant_size: variant.size,
        discount_percentage: variant.discount_percentage,
        unit_price: new Prisma.Decimal("100.00"),
        quantity,
        total_amount: new Prisma.Decimal(String(100 * quantity)),
        created_at: now,
      },
    });

    await prisma.shipments.create({
      data: {
        public_id: generatePublicId(PUBLIC_ID_PREFIXES.SHIPMENT),
        status: "pending",
        recipient_name: "Test Recipient",
        phone_number: "+15550000000",
        country: "Egypt",
        state: "Cairo",
        city: "Cairo",
        address_1: "12 Test Street",
        address_2: null,
        postal_code: null,
        orders_id: order.id,
        created_at: now,
        updated_at: now,
      },
    });

    const paymentStatus = committed
      ? payment_status.PAID
      : payment_status.PENDING;
    await prisma.payments.create({
      data: {
        public_id: generatePublicId(PUBLIC_ID_PREFIXES.PAYMENT),
        amount: new Prisma.Decimal("110.00"),
        payment_method: "mock",
        status: paymentStatus,
        transaction_reference: `mock_${nanoid(12)}`,
        paid_at: committed ? now : null,
        users_id: user.id,
        orders_id: order.id,
        created_at: now,
        updated_at: now,
      },
    });

    if (committed) {
      await prisma.inventory.update({
        where: { product_variants_id: variant.id },
        data: { quantity_on_hand: onHand - quantity, quantity_reserved: 0 },
      });
    } else if (status === order_status.PENDING) {
      await prisma.inventory.update({
        where: { product_variants_id: variant.id },
        data: { quantity_reserved: quantity },
      });
    }

    if (overrides.coupon) {
      await prisma.coupon_usages.create({
        data: {
          orders_id: order.id,
          coupons_id: overrides.coupon.id,
          users_id: user.id,
          discount_amount: new Prisma.Decimal("10.00"),
          redeemed_at: now,
        },
      });
      await prisma.coupons.update({
        where: { id: overrides.coupon.id },
        data: {
          usage_count: overrides.coupon.usage_count + 1,
          updated_at: now,
        },
      });
    }

    return { user, address, product, variant, order };
  }

  describe("placeOrder", () => {
    it("places an order with the confirmed projection (201-shape)", async () => {
      const { user, address, variant } = await createCheckoutContext({
        quantity: 2,
      });

      const result = await placeOrder(user.id, {
        address_public_id: address.public_id,
        payment_method: "mock",
      });

      expect(result.status).toBe("confirmed");
      expect(result.public_id).toMatch(/^ord_/);
      expect(result.order_number).toMatch(/^ORD-\d{8}$/);
      expect(result.subtotal).toBe("200.00");
      expect(result.discount_amount).toBe("0.00");
      expect(result.shipping_fee).toBe("10.00");
      expect(result.tax_amount).toBe("0.00");
      expect(result.total_amount).toBe("210.00");
      expect(result.notes).toBeNull();

      expect(result.shipping_address.recipient_name).toBe("Test Recipient");
      expect(result.shipping_address.country).toBe("Egypt");
      expect(result.shipping_address.postal_code).toBeNull();

      expect(result.payment).not.toBeNull();
      expect(result.payment!.status).toBe("paid");
      expect(result.payment!.method).toBe("mock");
      expect(result.payment!.provider).toBe("mock");
      expect(result.payment!.amount).toBe("210.00");
      expect(result.payment!.transaction_reference).toMatch(/^mock_/);
      expect(result.payment!.paid_at).toBeTruthy();

      expect(result.items).toHaveLength(1);
      expect(result.items[0].variant_public_id).toBe(variant.public_id);
      expect(result.items[0].unit_price).toBe("100.00");
      expect(result.items[0].discount_percentage).toBe("0.00");
      expect(result.items[0].quantity).toBe(2);
      expect(result.items[0].total_amount).toBe("200.00");
      expect(result.items[0].sku).toBe(variant.sku);

      expect(result).not.toHaveProperty("id");
      expect(result).not.toHaveProperty("users_id");
      expect(result).not.toHaveProperty("coupons_id");
      expect(result.items[0]).not.toHaveProperty("orders_id");
      expect(result.items[0]).not.toHaveProperty("product_variants_id");

      const stored = await prisma.orders.findUnique({
        where: { public_id: result.public_id },
      });
      expect(stored?.status).toBe(order_status.CONFIRMED);
      expect(stored?.order_number).toMatch(/^ORD-\d{8}$/);

      const inventory = await prisma.inventory.findUnique({
        where: { product_variants_id: variant.id },
      });
      expect(inventory?.quantity_on_hand).toBe(98);
      expect(inventory?.quantity_reserved).toBe(0);

      const cart = await prisma.carts.findFirst({
        where: { users_id: user.id },
      });
      expect(cart).toBeNull();

      const payment = await prisma.payments.findFirst({
        where: { orders_id: stored!.id },
      });
      expect(payment?.status).toBe(payment_status.PAID);

      const shipment = await prisma.shipments.findFirst({
        where: { orders_id: stored!.id },
      });
      expect(shipment?.status).toBe("pending");
      expect(shipment?.recipient_name).toBe("Test Recipient");
    });

    it("snapshots live pricing including a percentage discount", async () => {
      const { user, address } = await createCheckoutContext({
        quantity: 2,
        price: "100.00",
        discount_percentage: "10.00",
      });

      const result = await placeOrder(user.id, {
        address_public_id: address.public_id,
        payment_method: "mock",
      });

      expect(result.items[0].unit_price).toBe("90.00");
      expect(result.items[0].discount_percentage).toBe("10.00");
      expect(result.subtotal).toBe("180.00");
      expect(result.total_amount).toBe("190.00");
    });

    it("charges the flat shipping fee below the free threshold", async () => {
      const { user, address } = await createCheckoutContext({
        quantity: 4,
      });

      const result = await placeOrder(user.id, {
        address_public_id: address.public_id,
        payment_method: "mock",
      });

      expect(result.subtotal).toBe("400.00");
      expect(result.shipping_fee).toBe("10.00");
      expect(result.total_amount).toBe("410.00");
    });

    it("waives shipping at or above the free threshold", async () => {
      const { user, address } = await createCheckoutContext({
        quantity: 6,
      });

      const result = await placeOrder(user.id, {
        address_public_id: address.public_id,
        payment_method: "mock",
      });

      expect(result.subtotal).toBe("600.00");
      expect(result.shipping_fee).toBe("0.00");
      expect(result.total_amount).toBe("600.00");
    });

    it("applies a percentage coupon and records the usage", async () => {
      const { user, address } = await createCheckoutContext({
        quantity: 3,
      });
      const coupon = await createCoupon({
        code: `PERCENT-${nanoid(8)}`,
        discount_type: discount_type.PERCENTAGE,
        discount_value: "10.00",
      });

      const result = await placeOrder(user.id, {
        address_public_id: address.public_id,
        payment_method: "mock",
        coupon_code: coupon.code,
      });

      expect(result.subtotal).toBe("300.00");
      expect(result.discount_amount).toBe("30.00");
      expect(result.total_amount).toBe("280.00");

      const storedOrder = await prisma.orders.findUnique({
        where: { public_id: result.public_id },
        select: { coupons_id: true },
      });
      expect(storedOrder?.coupons_id).toBe(coupon.id);

      const usage = await prisma.coupon_usages.findFirst({
        where: { coupons_id: coupon.id },
      });
      expect(usage?.discount_amount.toNumber()).toBe(30);
      expect(usage?.users_id).toBe(user.id);

      const updatedCoupon = await prisma.coupons.findUnique({
        where: { id: coupon.id },
      });
      expect(updatedCoupon?.usage_count).toBe(1);
    });

    it("caps a percentage coupon at the maximum discount amount", async () => {
      const { user, address } = await createCheckoutContext({
        quantity: 3,
      });
      const coupon = await createCoupon({
        code: `CAP-${nanoid(8)}`,
        discount_type: discount_type.PERCENTAGE,
        discount_value: "10.00",
        maximum_discount_amount: "20.00",
      });

      const result = await placeOrder(user.id, {
        address_public_id: address.public_id,
        payment_method: "mock",
        coupon_code: coupon.code,
      });

      expect(result.discount_amount).toBe("20.00");
      expect(result.total_amount).toBe("290.00");
    });

    it("applies a fixed amount coupon", async () => {
      const { user, address } = await createCheckoutContext({
        quantity: 3,
      });
      const coupon = await createCoupon({
        code: `FIXED-${nanoid(8)}`,
        discount_type: discount_type.FIXED_AMOUNT,
        discount_value: "25.00",
      });

      const result = await placeOrder(user.id, {
        address_public_id: address.public_id,
        payment_method: "mock",
        coupon_code: coupon.code,
      });

      expect(result.discount_amount).toBe("25.00");
      expect(result.total_amount).toBe("285.00");
    });

    it("caps a fixed amount coupon at the maximum discount amount", async () => {
      const { user, address } = await createCheckoutContext({
        quantity: 3,
      });
      const coupon = await createCoupon({
        code: `FCAP-${nanoid(8)}`,
        discount_type: discount_type.FIXED_AMOUNT,
        discount_value: "50.00",
        maximum_discount_amount: "20.00",
      });

      const result = await placeOrder(user.id, {
        address_public_id: address.public_id,
        payment_method: "mock",
        coupon_code: coupon.code,
      });

      expect(result.discount_amount).toBe("20.00");
      expect(result.total_amount).toBe("290.00");
    });

    it("caps a fixed amount coupon larger than the subtotal at the subtotal", async () => {
      const { user, address } = await createCheckoutContext({
        quantity: 3,
      });
      const coupon = await createCoupon({
        code: `OVERSUB-${nanoid(8)}`,
        discount_type: discount_type.FIXED_AMOUNT,
        discount_value: "500.00",
      });

      const result = await placeOrder(user.id, {
        address_public_id: address.public_id,
        payment_method: "mock",
        coupon_code: coupon.code,
      });

      expect(result.discount_amount).toBe("300.00");
      expect(result.total_amount).toBe("10.00");
    });

    it("caps a percentage coupon over 100% at the subtotal", async () => {
      const { user, address } = await createCheckoutContext({
        quantity: 3,
      });
      const coupon = await createCoupon({
        code: `PERCENTCAP-${nanoid(8)}`,
        discount_type: discount_type.PERCENTAGE,
        discount_value: "150.00",
      });

      const result = await placeOrder(user.id, {
        address_public_id: address.public_id,
        payment_method: "mock",
        coupon_code: coupon.code,
      });

      expect(result.discount_amount).toBe("300.00");
      expect(result.total_amount).toBe("10.00");
    });

    it("throws ConflictError when the coupon is inactive", async () => {
      const { user, address } = await createCheckoutContext({ quantity: 3 });
      const coupon = await createCoupon({
        code: `INACTIVE-${nanoid(8)}`,
        is_active: false,
      });

      await expect(
        placeOrder(user.id, {
          address_public_id: address.public_id,
          payment_method: "mock",
          coupon_code: coupon.code,
        }),
      ).rejects.toThrow(ConflictError);
    });

    it("throws ConflictError when the coupon is deleted", async () => {
      const { user, address } = await createCheckoutContext({ quantity: 3 });
      const coupon = await createCoupon({
        code: `DELETED-${nanoid(8)}`,
        deleted_at: new Date(),
      });

      await expect(
        placeOrder(user.id, {
          address_public_id: address.public_id,
          payment_method: "mock",
          coupon_code: coupon.code,
        }),
      ).rejects.toThrow(ConflictError);
    });

    it("throws ConflictError when the coupon is expired", async () => {
      const { user, address } = await createCheckoutContext({ quantity: 3 });
      const coupon = await createCoupon({
        code: `EXPIRED-${nanoid(8)}`,
        expires_at: new Date(Date.now() - 1000),
      });

      await expect(
        placeOrder(user.id, {
          address_public_id: address.public_id,
          payment_method: "mock",
          coupon_code: coupon.code,
        }),
      ).rejects.toThrow(ConflictError);
    });

    it("throws ConflictError when the coupon has not started", async () => {
      const { user, address } = await createCheckoutContext({ quantity: 3 });
      const coupon = await createCoupon({
        code: `FUTURE-${nanoid(8)}`,
        starts_at: new Date(Date.now() + 60_000),
      });

      await expect(
        placeOrder(user.id, {
          address_public_id: address.public_id,
          payment_method: "mock",
          coupon_code: coupon.code,
        }),
      ).rejects.toThrow(ConflictError);
    });

    it("throws ConflictError when the coupon usage limit is reached", async () => {
      const { user, address } = await createCheckoutContext({ quantity: 3 });
      const coupon = await createCoupon({
        code: `LIMIT-${nanoid(8)}`,
        usage_limit: 5,
        usage_count: 5,
      });

      await expect(
        placeOrder(user.id, {
          address_public_id: address.public_id,
          payment_method: "mock",
          coupon_code: coupon.code,
        }),
      ).rejects.toThrow(ConflictError);
    });

    it("throws ConflictError when the subtotal is below the minimum order amount", async () => {
      const { user, address } = await createCheckoutContext({ quantity: 3 });
      const coupon = await createCoupon({
        code: `MIN-${nanoid(8)}`,
        minimum_order_amount: "1000.00",
      });

      await expect(
        placeOrder(user.id, {
          address_public_id: address.public_id,
          payment_method: "mock",
          coupon_code: coupon.code,
        }),
      ).rejects.toThrow(ConflictError);
    });

    it("throws NotFoundError when the user has no cart", async () => {
      const user = await createUser();
      const address = await createAddress(user.id);

      await expect(
        placeOrder(user.id, {
          address_public_id: address.public_id,
          payment_method: "mock",
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws ConflictError when the cart is empty", async () => {
      const { user, address } = await createCheckoutContext();
      await prisma.cart_items.deleteMany({});

      await expect(
        placeOrder(user.id, {
          address_public_id: address.public_id,
          payment_method: "mock",
        }),
      ).rejects.toThrow(ConflictError);
    });

    it("throws NotFoundError for a deleted address", async () => {
      const { user, address } = await createCheckoutContext({
        addressDeleted: true,
      });

      await expect(
        placeOrder(user.id, {
          address_public_id: address.public_id,
          payment_method: "mock",
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws ConflictError when a variant is soft-deleted", async () => {
      const { user, address } = await createCheckoutContext({
        variantDeleted: true,
      });

      await expect(
        placeOrder(user.id, {
          address_public_id: address.public_id,
          payment_method: "mock",
        }),
      ).rejects.toThrow(ConflictError);
    });

    it("throws ConflictError when a variant is not ACTIVE", async () => {
      const { user, address } = await createCheckoutContext({
        status: product_status.DRAFT,
      });

      await expect(
        placeOrder(user.id, {
          address_public_id: address.public_id,
          payment_method: "mock",
        }),
      ).rejects.toThrow(ConflictError);
    });

    it("throws ConflictError when the product is soft-deleted", async () => {
      const { user, address } = await createCheckoutContext({
        productDeleted: true,
      });

      await expect(
        placeOrder(user.id, {
          address_public_id: address.public_id,
          payment_method: "mock",
        }),
      ).rejects.toThrow(ConflictError);
    });

    it("throws ConflictError when stock is insufficient and rolls back reservations", async () => {
      const { user, address, variant } = await createCheckoutContext({
        quantity: 2,
        stock: 1,
      });

      await expect(
        placeOrder(user.id, {
          address_public_id: address.public_id,
          payment_method: "mock",
        }),
      ).rejects.toThrow(ConflictError);

      const inventory = await prisma.inventory.findUnique({
        where: { product_variants_id: variant.id },
      });
      expect(inventory?.quantity_on_hand).toBe(1);
      expect(inventory?.quantity_reserved).toBeNull();

      const cart = await prisma.carts.findFirst({
        where: { users_id: user.id },
      });
      expect(cart).not.toBeNull();
    });
  });

  describe("listOrders", () => {
    it("returns the user's orders with pagination", async () => {
      const { user, address } = await createCheckoutContext();
      const created = await placeOrder(user.id, {
        address_public_id: address.public_id,
        payment_method: "mock",
      });

      const result = await listOrders(user.id, {
        page: 1,
        limit: 20,
        sort: "-placed_at",
      });

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].public_id).toBe(created.public_id);
      expect(result.pagination).toMatchObject({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it("returns an empty list for a user with no orders", async () => {
      const user = await createUser();

      const result = await listOrders(user.id, {
        page: 1,
        limit: 20,
        sort: "-placed_at",
      });

      expect(result.orders).toEqual([]);
      expect(result.pagination.total).toBe(0);
    });

    it("filters by status", async () => {
      const { user, address } = await createCheckoutContext();
      await placeOrder(user.id, {
        address_public_id: address.public_id,
        payment_method: "mock",
      });

      const confirmed = await listOrders(user.id, {
        page: 1,
        limit: 20,
        sort: "-placed_at",
        status: "confirmed",
      });
      const pending = await listOrders(user.id, {
        page: 1,
        limit: 20,
        sort: "-placed_at",
        status: "pending",
      });

      expect(confirmed.orders).toHaveLength(1);
      expect(pending.orders).toHaveLength(0);
    });

    it("sorts by total_amount ascending", async () => {
      const { user, address, variant } = await createCheckoutContext({
        quantity: 1,
      });
      await placeOrder(user.id, {
        address_public_id: address.public_id,
        payment_method: "mock",
      });

      const cart2 = await createCart(user.id);
      await createCartItem(cart2.id, variant.id, 6);
      await placeOrder(user.id, {
        address_public_id: address.public_id,
        payment_method: "mock",
      });

      const result = await listOrders(user.id, {
        page: 1,
        limit: 20,
        sort: "total_amount",
      });

      expect(result.orders.map((order) => order.total_amount)).toEqual([
        "110.00",
        "600.00",
      ]);
    });

    it("returns only the requesting user's orders", async () => {
      const first = await createCheckoutContext();
      await placeOrder(first.user.id, {
        address_public_id: first.address.public_id,
        payment_method: "mock",
      });
      const second = await createCheckoutContext();
      await placeOrder(second.user.id, {
        address_public_id: second.address.public_id,
        payment_method: "mock",
      });

      const result = await listOrders(first.user.id, {
        page: 1,
        limit: 20,
        sort: "-placed_at",
      });

      expect(result.orders).toHaveLength(1);
    });
  });

  describe("getOrder", () => {
    it("returns the requesting user's order", async () => {
      const { user, address } = await createCheckoutContext();
      const created = await placeOrder(user.id, {
        address_public_id: address.public_id,
        payment_method: "mock",
      });

      const result = await getOrder(user.id, created.public_id);

      expect(result.public_id).toBe(created.public_id);
      expect(result.status).toBe("confirmed");
    });

    it("throws NotFoundError for another user's order", async () => {
      const { user, address } = await createCheckoutContext();
      const created = await placeOrder(user.id, {
        address_public_id: address.public_id,
        payment_method: "mock",
      });
      const other = await createUser();

      await expect(getOrder(other.id, created.public_id)).rejects.toThrow(
        NotFoundError,
      );
    });

    it("throws NotFoundError for an unknown order", async () => {
      const user = await createUser();

      await expect(getOrder(user.id, `ord_${nanoid(10)}`)).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("updateOrderStatus", () => {
    it("transitions pending to confirmed, committing stock and paying the payment", async () => {
      const { user, order, variant } = await createOrderInStatus({
        status: order_status.PENDING,
        quantity: 2,
        onHand: 100,
      });

      const result = await updateOrderStatus(
        order.public_id,
        { status: "confirmed" },
        { id: user.id },
      );

      expect(result.status).toBe("confirmed");

      const inventory = await prisma.inventory.findUnique({
        where: { product_variants_id: variant.id },
      });
      expect(inventory?.quantity_on_hand).toBe(98);
      expect(inventory?.quantity_reserved).toBe(0);

      const payment = await prisma.payments.findFirst({
        where: { orders_id: order.id },
      });
      expect(payment?.status).toBe(payment_status.PAID);
      expect(payment?.paid_at).toBeTruthy();
    });

    it("transitions pending to cancelled, releasing reserved stock", async () => {
      const { user, order, variant } = await createOrderInStatus({
        status: order_status.PENDING,
        quantity: 2,
        onHand: 100,
      });

      const result = await updateOrderStatus(
        order.public_id,
        { status: "cancelled" },
        { id: user.id },
      );

      expect(result.status).toBe("cancelled");

      const inventory = await prisma.inventory.findUnique({
        where: { product_variants_id: variant.id },
      });
      expect(inventory?.quantity_on_hand).toBe(100);
      expect(inventory?.quantity_reserved).toBe(0);

      const payment = await prisma.payments.findFirst({
        where: { orders_id: order.id },
      });
      expect(payment?.status).toBe(payment_status.PENDING);
    });

    it("transitions confirmed to cancelled, refunding and restocking inventory", async () => {
      const { user, order, variant } = await createOrderInStatus({
        status: order_status.CONFIRMED,
        quantity: 2,
        onHand: 100,
      });

      const result = await updateOrderStatus(
        order.public_id,
        { status: "cancelled" },
        { id: user.id },
      );

      expect(result.status).toBe("cancelled");

      const inventory = await prisma.inventory.findUnique({
        where: { product_variants_id: variant.id },
      });
      expect(inventory?.quantity_on_hand).toBe(100);
      expect(inventory?.quantity_reserved).toBe(0);

      const payment = await prisma.payments.findFirst({
        where: { orders_id: order.id },
      });
      expect(payment?.status).toBe(payment_status.REFUNDED);
      expect(payment?.refunded_at).toBeTruthy();
    });

    it("transitions processing to cancelled, refunding and restocking inventory", async () => {
      const { user, order, variant } = await createOrderInStatus({
        status: order_status.PROCESSING,
        quantity: 3,
        onHand: 100,
      });

      const result = await updateOrderStatus(
        order.public_id,
        { status: "cancelled" },
        { id: user.id },
      );

      expect(result.status).toBe("cancelled");

      const inventory = await prisma.inventory.findUnique({
        where: { product_variants_id: variant.id },
      });
      expect(inventory?.quantity_on_hand).toBe(100);
      expect(inventory?.quantity_reserved).toBe(0);

      const payment = await prisma.payments.findFirst({
        where: { orders_id: order.id },
      });
      expect(payment?.status).toBe(payment_status.REFUNDED);
    });

    it("transitions returned to refunded, restocking the returned quantities", async () => {
      const { user, order, variant } = await createOrderInStatus({
        status: order_status.RETURNED,
        quantity: 2,
        onHand: 100,
      });

      const result = await updateOrderStatus(
        order.public_id,
        { status: "refunded" },
        { id: user.id },
      );

      expect(result.status).toBe("refunded");

      const inventory = await prisma.inventory.findUnique({
        where: { product_variants_id: variant.id },
      });
      expect(inventory?.quantity_on_hand).toBe(100);
      expect(inventory?.quantity_reserved).toBe(0);

      const payment = await prisma.payments.findFirst({
        where: { orders_id: order.id },
      });
      expect(payment?.status).toBe(payment_status.REFUNDED);
      expect(payment?.refunded_at).toBeTruthy();
    });

    it("restocks every line when a confirmed multi-line order is cancelled", async () => {
      const user = await createUser();
      const address = await createAddress(user.id);
      const first = await createProduct();
      const firstVariant = await createVariant(first.id, {
        sku: `SKU-${nanoid(8)}`,
        price: "50.00",
      });
      const second = await createProduct();
      const secondVariant = await createVariant(second.id, {
        sku: `SKU-${nanoid(8)}`,
        price: "75.00",
      });
      await createInventory(firstVariant.id, {
        quantity_on_hand: 100,
        quantity_reserved: 0,
      });
      await createInventory(secondVariant.id, {
        quantity_on_hand: 50,
        quantity_reserved: 0,
      });
      const now = new Date();

      const order = await prisma.orders.create({
        data: {
          public_id: generatePublicId(PUBLIC_ID_PREFIXES.ORDER),
          order_number: `ORD-${nanoid(10)}`,
          status: order_status.CONFIRMED,
          shipping_cost: new Prisma.Decimal("10.00"),
          subtotal: new Prisma.Decimal("125.00"),
          discount_amount: new Prisma.Decimal("0.00"),
          shipping_fee: new Prisma.Decimal("10.00"),
          tax_amount: new Prisma.Decimal("0.00"),
          total_amount: new Prisma.Decimal("135.00"),
          notes: null,
          placed_at: now,
          created_at: now,
          updated_at: now,
          users_id: user.id,
          coupons_id: null,
          user_addresses_id: address.id,
        },
      });

      await prisma.order_items.createMany({
        data: [
          {
            orders_id: order.id,
            product_variants_id: firstVariant.id,
            product_name: first.name,
            product_slug: first.slug,
            sku: firstVariant.sku,
            unit_price: new Prisma.Decimal("50.00"),
            quantity: 2,
            total_amount: new Prisma.Decimal("100.00"),
            created_at: now,
          },
          {
            orders_id: order.id,
            product_variants_id: secondVariant.id,
            product_name: second.name,
            product_slug: second.slug,
            sku: secondVariant.sku,
            unit_price: new Prisma.Decimal("75.00"),
            quantity: 3,
            total_amount: new Prisma.Decimal("225.00"),
            created_at: now,
          },
        ],
      });

      await prisma.inventory.update({
        where: { product_variants_id: firstVariant.id },
        data: { quantity_on_hand: 98, quantity_reserved: 0 },
      });
      await prisma.inventory.update({
        where: { product_variants_id: secondVariant.id },
        data: { quantity_on_hand: 47, quantity_reserved: 0 },
      });

      await prisma.shipments.create({
        data: {
          public_id: generatePublicId(PUBLIC_ID_PREFIXES.SHIPMENT),
          status: "pending",
          recipient_name: "Test Recipient",
          phone_number: "+15550000000",
          country: "Egypt",
          state: "Cairo",
          city: "Cairo",
          address_1: "12 Test Street",
          address_2: null,
          postal_code: null,
          orders_id: order.id,
          created_at: now,
          updated_at: now,
        },
      });

      await prisma.payments.create({
        data: {
          public_id: generatePublicId(PUBLIC_ID_PREFIXES.PAYMENT),
          amount: new Prisma.Decimal("135.00"),
          payment_method: "mock",
          status: payment_status.PAID,
          transaction_reference: `mock_${nanoid(12)}`,
          paid_at: now,
          users_id: user.id,
          orders_id: order.id,
          created_at: now,
          updated_at: now,
        },
      });

      const result = await updateOrderStatus(
        order.public_id,
        { status: "cancelled" },
        { id: user.id },
      );

      expect(result.status).toBe("cancelled");

      const firstInventory = await prisma.inventory.findUnique({
        where: { product_variants_id: firstVariant.id },
      });
      const secondInventory = await prisma.inventory.findUnique({
        where: { product_variants_id: secondVariant.id },
      });
      expect(firstInventory?.quantity_on_hand).toBe(100);
      expect(secondInventory?.quantity_on_hand).toBe(50);
    });

    it("does not restock twice when a repeated transition is rejected", async () => {
      const { user, order, variant } = await createOrderInStatus({
        status: order_status.CONFIRMED,
        quantity: 2,
        onHand: 100,
      });

      await updateOrderStatus(
        order.public_id,
        { status: "cancelled" },
        { id: user.id },
      );

      await expect(
        updateOrderStatus(
          order.public_id,
          { status: "confirmed" },
          { id: user.id },
        ),
      ).rejects.toThrow(ConflictError);

      const inventory = await prisma.inventory.findUnique({
        where: { product_variants_id: variant.id },
      });
      expect(inventory?.quantity_on_hand).toBe(100);
      expect(inventory?.quantity_reserved).toBe(0);
    });

    it("rolls back the transition when restock finds no inventory record", async () => {
      const { user, order, variant } = await createOrderInStatus({
        status: order_status.CONFIRMED,
        quantity: 2,
        onHand: 100,
      });

      await prisma.inventory.delete({
        where: { product_variants_id: variant.id },
      });

      await expect(
        updateOrderStatus(
          order.public_id,
          { status: "cancelled" },
          { id: user.id },
        ),
      ).rejects.toThrow(ConflictError);

      const stored = await prisma.orders.findUnique({
        where: { public_id: order.public_id },
      });
      expect(stored?.status).toBe(order_status.CONFIRMED);

      const payment = await prisma.payments.findFirst({
        where: { orders_id: order.id },
      });
      expect(payment?.status).toBe(payment_status.PAID);
    });

    it("restores the coupon quota when a confirmed order is cancelled", async () => {
      const coupon = await createCoupon({
        code: `RESTORE-${nanoid(8)}`,
        usage_limit: 1,
      });
      const { user, order } = await createOrderInStatus({
        status: order_status.CONFIRMED,
        coupon,
      });

      await updateOrderStatus(
        order.public_id,
        { status: "cancelled" },
        { id: user.id },
      );

      const usage = await prisma.coupon_usages.findFirst({
        where: { orders_id: order.id },
      });
      expect(usage).toBeNull();

      const updatedCoupon = await prisma.coupons.findUnique({
        where: { id: coupon.id },
      });
      expect(updatedCoupon?.usage_count).toBe(0);

      const address = await createAddress(user.id);
      const cart = await createCart(user.id);
      const variant = await createVariant(
        await createProduct().then((p) => p.id),
        { sku: `SKU-${nanoid(8)}`, price: "100.00" },
      );
      await createInventory(variant.id, { quantity_on_hand: 10 });
      await createCartItem(cart.id, variant.id, 1);

      const result = await placeOrder(user.id, {
        address_public_id: address.public_id,
        payment_method: "mock",
        coupon_code: coupon.code,
      });
      expect(Number(result.discount_amount)).toBeGreaterThan(0);
    });

    it("restores the coupon quota when a pending order is cancelled", async () => {
      const coupon = await createCoupon({
        code: `RESTORE-P-${nanoid(8)}`,
        usage_limit: 1,
      });
      const { user, order } = await createOrderInStatus({
        status: order_status.PENDING,
        coupon,
      });

      await updateOrderStatus(
        order.public_id,
        { status: "cancelled" },
        { id: user.id },
      );

      const usage = await prisma.coupon_usages.findFirst({
        where: { orders_id: order.id },
      });
      expect(usage).toBeNull();

      const updatedCoupon = await prisma.coupons.findUnique({
        where: { id: coupon.id },
      });
      expect(updatedCoupon?.usage_count).toBe(0);
    });

    it("keeps the coupon quota consumed when a returned order is refunded", async () => {
      const coupon = await createCoupon({
        code: `KEEP-${nanoid(8)}`,
        usage_limit: 1,
      });
      const { user, order } = await createOrderInStatus({
        status: order_status.RETURNED,
        coupon,
      });

      await updateOrderStatus(
        order.public_id,
        { status: "refunded" },
        { id: user.id },
      );

      const usage = await prisma.coupon_usages.findFirst({
        where: { orders_id: order.id },
      });
      expect(usage).not.toBeNull();

      const updatedCoupon = await prisma.coupons.findUnique({
        where: { id: coupon.id },
      });
      expect(updatedCoupon?.usage_count).toBe(1);
    });

    it("no-ops coupon restore when the cancelled order had no coupon", async () => {
      const { user, order } = await createOrderInStatus({
        status: order_status.CONFIRMED,
      });

      await updateOrderStatus(
        order.public_id,
        { status: "cancelled" },
        { id: user.id },
      );

      const usage = await prisma.coupon_usages.findFirst({
        where: { orders_id: order.id },
      });
      expect(usage).toBeNull();
    });

    it("transitions confirmed to processing with no side effects", async () => {
      const { user, order, variant } = await createOrderInStatus({
        status: order_status.CONFIRMED,
      });

      const result = await updateOrderStatus(
        order.public_id,
        { status: "processing" },
        { id: user.id },
      );

      expect(result.status).toBe("processing");

      const inventory = await prisma.inventory.findUnique({
        where: { product_variants_id: variant.id },
      });
      expect(inventory?.quantity_on_hand).toBe(99);

      const payment = await prisma.payments.findFirst({
        where: { orders_id: order.id },
      });
      expect(payment?.status).toBe(payment_status.PAID);
    });

    it("transitions processing to shipped, updating the shipment row", async () => {
      const { user, order } = await createOrderInStatus({
        status: order_status.PROCESSING,
      });

      const result = await updateOrderStatus(
        order.public_id,
        { status: "shipped", carrier: "DHL", tracking_number: "TRK-123" },
        { id: user.id },
      );

      expect(result.status).toBe("shipped");
      expect(result.shipment.status).toBe("shipped");
      expect(result.shipment.carrier).toBe("DHL");
      expect(result.shipment.tracking_number).toBe("TRK-123");
      expect(result.shipment.shipped_at).toBeTruthy();

      const shipment = await prisma.shipments.findFirst({
        where: { orders_id: order.id },
      });
      expect(shipment?.status).toBe("shipped");
      expect(shipment?.carrier).toBe("DHL");
      expect(shipment?.tracking_number).toBe("TRK-123");
    });

    it("transitions shipped to delivered", async () => {
      const { user, order } = await createOrderInStatus({
        status: order_status.SHIPPED,
      });

      const result = await updateOrderStatus(
        order.public_id,
        { status: "delivered" },
        { id: user.id },
      );

      expect(result.status).toBe("delivered");
      expect(result.shipment.status).toBe("delivered");
      expect(result.shipment.delivered_at).toBeTruthy();
    });

    it("transitions delivered to returned", async () => {
      const { user, order } = await createOrderInStatus({
        status: order_status.DELIVERED,
      });

      const result = await updateOrderStatus(
        order.public_id,
        { status: "returned" },
        { id: user.id },
      );

      expect(result.status).toBe("returned");
    });

    it("transitions returned to refunded", async () => {
      const { user, order } = await createOrderInStatus({
        status: order_status.RETURNED,
      });

      const result = await updateOrderStatus(
        order.public_id,
        { status: "refunded" },
        { id: user.id },
      );

      expect(result.status).toBe("refunded");

      const payment = await prisma.payments.findFirst({
        where: { orders_id: order.id },
      });
      expect(payment?.status).toBe(payment_status.REFUNDED);
      expect(payment?.refunded_at).toBeTruthy();
    });

    it("throws ConflictError for an illegal transition", async () => {
      const { user, order } = await createOrderInStatus({
        status: order_status.PENDING,
      });

      await expect(
        updateOrderStatus(
          order.public_id,
          { status: "shipped" },
          { id: user.id },
        ),
      ).rejects.toThrow(ConflictError);
    });

    it("throws ConflictError when the target status equals the current status", async () => {
      const { user, order } = await createOrderInStatus({
        status: order_status.CONFIRMED,
      });

      await expect(
        updateOrderStatus(
          order.public_id,
          { status: "confirmed" },
          { id: user.id },
        ),
      ).rejects.toThrow(ConflictError);
    });

    it("throws NotFoundError for an unknown order", async () => {
      const user = await createUser();

      await expect(
        updateOrderStatus(
          `ord_${nanoid(10)}`,
          { status: "processing" },
          { id: user.id },
        ),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("listAdminOrders", () => {
    it("returns admin rows with customer summaries and no items or payment", async () => {
      const { user, address } = await createCheckoutContext();
      await placeOrder(user.id, {
        address_public_id: address.public_id,
        payment_method: "mock",
      });

      const result = await listAdminOrders({
        page: 1,
        limit: 20,
        sort: "-placed_at",
      });

      expect(result.orders).toHaveLength(1);
      const row = result.orders[0];
      expect(row.customer_name).toBe("Test User");
      expect(row.customer_public_id).toMatch(/^usr_/);
      expect(row.customer_email).toMatch(/^test-/);
      expect(row.total_amount).toBe("110.00");
      expect(row).not.toHaveProperty("items");
      expect(row).not.toHaveProperty("payment");
      expect(row).not.toHaveProperty("shipment");
    });

    it("filters by search across the customer name", async () => {
      const ahmed = await createCheckoutContext();
      await prisma.users.update({
        where: { id: ahmed.user.id },
        data: { first_name: "Ahmed", last_name: "Aziz" },
      });
      await placeOrder(ahmed.user.id, {
        address_public_id: ahmed.address.public_id,
        payment_method: "mock",
      });
      const sara = await createCheckoutContext();
      await prisma.users.update({
        where: { id: sara.user.id },
        data: { first_name: "Sara", last_name: "Khaled" },
      });
      await placeOrder(sara.user.id, {
        address_public_id: sara.address.public_id,
        payment_method: "mock",
      });

      const result = await listAdminOrders({
        page: 1,
        limit: 20,
        sort: "-placed_at",
        search: "Aziz",
      });

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0].customer_name).toBe("Ahmed Aziz");
    });

    it("filters by status", async () => {
      const { user, address } = await createCheckoutContext();
      await placeOrder(user.id, {
        address_public_id: address.public_id,
        payment_method: "mock",
      });

      const confirmed = await listAdminOrders({
        page: 1,
        limit: 20,
        sort: "-placed_at",
        status: "confirmed",
      });
      const pending = await listAdminOrders({
        page: 1,
        limit: 20,
        sort: "-placed_at",
        status: "pending",
      });

      expect(confirmed.orders).toHaveLength(1);
      expect(pending.orders).toHaveLength(0);
    });

    it("sorts by customer_name ascending", async () => {
      const alice = await createCheckoutContext();
      await prisma.users.update({
        where: { id: alice.user.id },
        data: { first_name: "Alice", last_name: "Brown" },
      });
      await placeOrder(alice.user.id, {
        address_public_id: alice.address.public_id,
        payment_method: "mock",
      });
      const zack = await createCheckoutContext();
      await prisma.users.update({
        where: { id: zack.user.id },
        data: { first_name: "Zack", last_name: "White" },
      });
      await placeOrder(zack.user.id, {
        address_public_id: zack.address.public_id,
        payment_method: "mock",
      });

      const result = await listAdminOrders({
        page: 1,
        limit: 20,
        sort: "customer_name",
      });

      expect(result.orders[0].customer_name).toBe("Alice Brown");
      expect(result.orders[1].customer_name).toBe("Zack White");
    });
  });

  describe("getAdminOrder", () => {
    it("returns the full admin projection", async () => {
      const { user, address } = await createCheckoutContext();
      const created = await placeOrder(user.id, {
        address_public_id: address.public_id,
        payment_method: "mock",
      });

      const result = await getAdminOrder(created.public_id);

      expect(result.public_id).toBe(created.public_id);
      expect(result.shipment.public_id).toMatch(/^shp_/);
      expect(result.shipment.status).toBe("pending");
      expect(result.customer_name).toBe("Test User");
      expect(result.customer_email).toMatch(/^test-/);
      expect(result.items).toHaveLength(1);
    });

    it("throws NotFoundError for an unknown order", async () => {
      await expect(getAdminOrder(`ord_${nanoid(10)}`)).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("incrementCouponUsage", () => {
    it("increments usage_count atomically when below the usage limit", async () => {
      const coupon = await createCoupon({
        code: `INC-${nanoid(8)}`,
        usage_limit: 5,
        usage_count: 4,
      });

      const affected = await ordersRepository.incrementCouponUsage(coupon.id);

      expect(affected).toBe(1);
      const updated = await prisma.coupons.findUnique({
        where: { id: coupon.id },
      });
      expect(updated?.usage_count).toBe(5);
    });

    it("returns 0 and leaves usage_count unchanged when the limit is reached", async () => {
      const coupon = await createCoupon({
        code: `LIMITED-${nanoid(8)}`,
        usage_limit: 5,
        usage_count: 5,
      });

      const affected = await ordersRepository.incrementCouponUsage(coupon.id);

      expect(affected).toBe(0);
      const updated = await prisma.coupons.findUnique({
        where: { id: coupon.id },
      });
      expect(updated?.usage_count).toBe(5);
    });
  });
});
