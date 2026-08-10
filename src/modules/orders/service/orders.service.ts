import { prisma } from "../../../config/database.js";
import { Prisma } from "../../../generated/prisma/client.js";
import {
  discount_type,
  order_status,
  product_status,
} from "../../../generated/prisma/enums.js";
import {
  FLAT_SHIPPING_FEE,
  FREE_SHIPPING_THRESHOLD,
} from "../../../shared/constants/index.js";
import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import { formatPaginationMeta } from "../../../shared/utils/index.js";
import {
  computeFinalPrice,
  decimalToFixed,
} from "../../products/utils/format.js";
import { getPaymentGateway } from "../payment/index.js";
import {
  ordersRepository,
  type CheckoutCartRow,
  type CustomerOrderRow,
} from "../repository/orders.repository.js";
import { parseSort } from "../utils/sort.js";
import type {
  ListOrdersQuery,
  ListOrdersResult,
  OrderResult,
  PlaceOrderInput,
} from "../dto/orders.js";

interface CheckoutLine {
  variantId: number;
  quantity: number;
  unitPrice: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  variant: CheckoutCartRow["cart_items"][number]["product_variants"];
  product: CheckoutCartRow["cart_items"][number]["product_variants"]["products"];
}

export function toOrderStatusEnum(status: string): order_status {
  return order_status[status.toUpperCase() as keyof typeof order_status];
}

export function toOrderResult(row: CustomerOrderRow): OrderResult {
  const items = row.order_items.map((item) => ({
    product_public_id: item.product_variants.products.public_id,
    variant_public_id: item.product_variants.public_id,
    product_name: item.product_name,
    product_slug: item.product_slug,
    sku: item.sku,
    color: item.variant_color,
    size: item.variant_size,
    unit_price: item.unit_price.toFixed(2),
    discount_percentage: decimalToFixed(item.discount_percentage),
    quantity: item.quantity,
    total_amount: item.total_amount.toFixed(2),
    created_at: item.created_at,
  }));

  const shipment = row.shipments!;
  const payment = row.payments;

  return {
    public_id: row.public_id,
    order_number: row.order_number,
    status: row.status.toLowerCase(),
    placed_at: row.placed_at,
    subtotal: row.subtotal.toFixed(2),
    discount_amount: row.discount_amount.toFixed(2),
    shipping_fee: row.shipping_fee.toFixed(2),
    tax_amount: row.tax_amount.toFixed(2),
    total_amount: row.total_amount.toFixed(2),
    notes: row.notes,
    shipping_address: {
      recipient_name: shipment.recipient_name,
      phone_number: shipment.phone_number,
      country: shipment.country,
      state: shipment.state,
      city: shipment.city,
      address_1: shipment.address_1,
      address_2: shipment.address_2,
      postal_code: shipment.postal_code,
    },
    payment: payment
      ? {
          public_id: payment.public_id,
          status: payment.status.toLowerCase(),
          method: payment.payment_method,
          provider: "mock",
          transaction_reference: payment.transaction_reference,
          amount: payment.amount.toFixed(2),
          paid_at: payment.paid_at,
        }
      : null,
    items,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function placeOrder(
  userId: number,
  input: PlaceOrderInput,
): Promise<OrderResult> {
  const row = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM (SELECT pg_advisory_xact_lock(${userId})) AS lock`;

    const cart = await ordersRepository.findCartWithLinesByUserId(userId, tx);
    if (!cart) {
      throw new NotFoundError("Cart not found for this user");
    }
    if (cart.cart_items.length === 0) {
      throw new ConflictError("The cart is empty");
    }

    const address = await ordersRepository.findAddressByPublicIdAndUserId(
      input.address_public_id,
      userId,
      tx,
    );
    if (!address) {
      throw new NotFoundError("Address not found");
    }

    const lines: CheckoutLine[] = cart.cart_items.map((line) => {
      const variant = line.product_variants;
      const product = variant.products;

      if (
        variant.deleted_at !== null ||
        variant.status !== product_status.ACTIVE ||
        product.deleted_at !== null
      ) {
        throw new ConflictError(
          "One or more items in your cart are no longer purchasable",
        );
      }

      const unitPrice = new Prisma.Decimal(
        computeFinalPrice(variant.price, variant.discount_percentage),
      );

      return {
        variantId: variant.id,
        quantity: line.quantity,
        unitPrice,
        lineTotal: unitPrice.mul(line.quantity),
        variant,
        product,
      };
    });

    for (const line of lines) {
      const reserved = await ordersRepository.reserveStock(
        line.variantId,
        line.quantity,
        tx,
      );
      if (reserved === 0) {
        throw new ConflictError("Insufficient stock for one or more items");
      }
    }

    const subtotal = lines.reduce(
      (acc, line) => acc.plus(line.lineTotal),
      new Prisma.Decimal(0),
    );

    const now = new Date();

    let discountAmount = new Prisma.Decimal(0);
    let couponsId: number | null = null;

    if (input.coupon_code) {
      const coupon = await ordersRepository.findCouponByCode(
        input.coupon_code,
        tx,
      );
      if (!coupon) {
        throw new ConflictError("Coupon is invalid or not applicable");
      }

      const withinWindow =
        coupon.deleted_at === null &&
        coupon.is_active &&
        (coupon.starts_at === null || coupon.starts_at <= now) &&
        (coupon.expires_at === null || coupon.expires_at >= now) &&
        coupon.usage_count < coupon.usage_limit &&
        (coupon.minimum_order_amount === null ||
          subtotal.gte(coupon.minimum_order_amount));

      const usages = await ordersRepository.countCouponUsagesByUser(
        coupon.id,
        userId,
        tx,
      );
      const withinPerUserLimit = usages < coupon.usage_limit_per_user;

      if (!withinWindow || !withinPerUserLimit) {
        throw new ConflictError("Coupon is invalid or not applicable");
      }

      if (coupon.discount_type === discount_type.FIXED_AMOUNT) {
        discountAmount = coupon.discount_value;
        if (
          coupon.maximum_discount_amount !== null &&
          discountAmount.gt(coupon.maximum_discount_amount)
        ) {
          discountAmount = coupon.maximum_discount_amount;
        }
      } else {
        discountAmount = subtotal.mul(coupon.discount_value).div(100);
        if (
          coupon.maximum_discount_amount !== null &&
          discountAmount.gt(coupon.maximum_discount_amount)
        ) {
          discountAmount = coupon.maximum_discount_amount;
        }
      }
      if (discountAmount.lt(0)) {
        discountAmount = new Prisma.Decimal(0);
      }
      discountAmount = Prisma.Decimal.min(discountAmount, subtotal);
      discountAmount = discountAmount.toDecimalPlaces(2);
      couponsId = coupon.id;
    }

    const shippingFee = subtotal.gte(
      new Prisma.Decimal(FREE_SHIPPING_THRESHOLD),
    )
      ? new Prisma.Decimal(0)
      : new Prisma.Decimal(FLAT_SHIPPING_FEE);
    const taxAmount = new Prisma.Decimal(0);
    const totalAmount = subtotal
      .minus(discountAmount)
      .plus(shippingFee)
      .plus(taxAmount);

    const order = await ordersRepository.createOrder(
      {
        users_id: userId,
        user_addresses_id: address.id,
        coupons_id: couponsId,
        subtotal,
        discount_amount: discountAmount,
        shipping_fee: shippingFee,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        notes: input.notes ?? null,
        placed_at: now,
      },
      tx,
    );

    await ordersRepository.updateOrderNumber(
      order.id,
      `ORD-${String(order.id).padStart(8, "0")}`,
      tx,
    );

    await ordersRepository.createShipment(
      {
        orders_id: order.id,
        recipient_name: address.recipient_name,
        phone_number: address.phone_number,
        country: address.country,
        state: address.state,
        city: address.city,
        address_1: address.address_1,
        address_2: address.address_2,
        postal_code: address.zip_code,
      },
      tx,
    );

    await ordersRepository.createOrderItems(
      lines.map((line) => ({
        orders_id: order.id,
        product_variants_id: line.variantId,
        product_name: line.product.name,
        product_slug: line.product.slug,
        sku: line.variant.sku,
        variant_color: line.variant.color,
        variant_size: line.variant.size,
        variant_weight: line.variant.weight,
        variant_width: line.variant.width,
        variant_length: line.variant.length,
        variant_height: line.variant.height,
        discount_percentage: line.variant.discount_percentage,
        unit_price: line.unitPrice,
        quantity: line.quantity,
        total_amount: line.lineTotal,
        created_at: now,
      })),
      tx,
    );

    if (couponsId !== null) {
      const incremented = await ordersRepository.incrementCouponUsage(
        couponsId,
        tx,
      );
      if (incremented === 0) {
        throw new ConflictError("Coupon is invalid or not applicable");
      }
      await ordersRepository.createCouponUsage(
        {
          orders_id: order.id,
          coupons_id: couponsId,
          users_id: userId,
          discount_amount: discountAmount,
          redeemed_at: now,
        },
        tx,
      );
    }

    const paymentGateway = getPaymentGateway(input.payment_method);
    const payment = paymentGateway.process(totalAmount, input.payment_method);

    await ordersRepository.createPayment(
      {
        orders_id: order.id,
        users_id: userId,
        amount: totalAmount,
        payment_method: input.payment_method,
        transaction_reference: payment.transactionReference,
        paid_at: payment.paidAt,
      },
      tx,
    );

    for (const line of lines) {
      await ordersRepository.commitStock(line.variantId, line.quantity, tx);
    }

    await ordersRepository.updateOrderStatus(
      order.id,
      order_status.CONFIRMED,
      new Date(),
      tx,
    );

    await ordersRepository.deleteCartLines(cart.id, tx);
    await ordersRepository.deleteCart(cart.id, tx);

    const created = await ordersRepository.findOrderById(order.id, tx);
    return created!;
  });

  return toOrderResult(row);
}

export async function listOrders(
  userId: number,
  query: ListOrdersQuery,
): Promise<ListOrdersResult> {
  const { field, direction } = parseSort(query.sort);
  const status = query.status ? toOrderStatusEnum(query.status) : undefined;

  const orderBy: Prisma.ordersOrderByWithRelationInput =
    field === "total_amount"
      ? { total_amount: direction }
      : field === "order_number"
        ? { order_number: direction }
        : { placed_at: direction };

  const [rows, total] = await Promise.all([
    ordersRepository.listOrdersByUser(
      userId,
      status,
      orderBy,
      (query.page - 1) * query.limit,
      query.limit,
    ),
    ordersRepository.countOrdersByUser(userId, status),
  ]);

  return {
    orders: rows.map(toOrderResult),
    pagination: formatPaginationMeta(query.page, query.limit, total),
  };
}

export async function getOrder(
  userId: number,
  orderPublicId: string,
): Promise<OrderResult> {
  const row = await ordersRepository.findOrderByPublicIdAndUserId(
    orderPublicId,
    userId,
  );

  if (!row) {
    throw new NotFoundError("Order not found");
  }

  return toOrderResult(row);
}
