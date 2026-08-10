import { dbSchema, prisma } from "../../../config/database.js";
import { Prisma } from "../../../generated/prisma/client.js";
import {
  order_status,
  payment_status,
} from "../../../generated/prisma/enums.js";
import { PUBLIC_ID_PREFIXES } from "../../../shared/constants/index.js";
import { generatePublicId } from "../../../shared/utils/index.js";

type DbClient = Prisma.TransactionClient | typeof prisma;

export const customerOrderSelect = {
  id: true,
  public_id: true,
  order_number: true,
  status: true,
  placed_at: true,
  subtotal: true,
  discount_amount: true,
  shipping_fee: true,
  tax_amount: true,
  total_amount: true,
  notes: true,
  created_at: true,
  updated_at: true,
  shipments: {
    select: {
      public_id: true,
      status: true,
      carrier: true,
      tracking_number: true,
      shipped_at: true,
      delivered_at: true,
      recipient_name: true,
      phone_number: true,
      country: true,
      state: true,
      city: true,
      address_1: true,
      address_2: true,
      postal_code: true,
    },
  },
  payments: {
    select: {
      public_id: true,
      status: true,
      payment_method: true,
      transaction_reference: true,
      amount: true,
      paid_at: true,
    },
  },
  order_items: {
    orderBy: [
      { created_at: "asc" },
      { id: "asc" },
    ] as Prisma.order_itemsOrderByWithRelationInput[],
    select: {
      quantity: true,
      unit_price: true,
      total_amount: true,
      created_at: true,
      product_name: true,
      product_slug: true,
      sku: true,
      variant_color: true,
      variant_size: true,
      discount_percentage: true,
      product_variants_id: true,
      product_variants: {
        select: {
          public_id: true,
          products: {
            select: {
              public_id: true,
            },
          },
        },
      },
    },
  },
} as const;

export type CustomerOrderRow = Prisma.ordersGetPayload<{
  select: typeof customerOrderSelect;
}>;

const adminOrderSelect = {
  ...customerOrderSelect,
  users: {
    select: {
      public_id: true,
      first_name: true,
      last_name: true,
      email: true,
      phone_number: true,
    },
  },
} as const;

export type AdminOrderRow = Prisma.ordersGetPayload<{
  select: typeof adminOrderSelect;
}>;

const cartWithLinesSelect = {
  id: true,
  cart_items: {
    orderBy: [
      { created_at: "asc" },
      { id: "asc" },
    ] as Prisma.cart_itemsOrderByWithRelationInput[],
    select: {
      quantity: true,
      product_variants: {
        select: {
          id: true,
          public_id: true,
          sku: true,
          color: true,
          size: true,
          price: true,
          discount_percentage: true,
          weight: true,
          width: true,
          length: true,
          height: true,
          status: true,
          deleted_at: true,
          products: {
            select: {
              public_id: true,
              name: true,
              slug: true,
              deleted_at: true,
            },
          },
        },
      },
    },
  },
} as const;

export type CheckoutCartRow = Prisma.cartsGetPayload<{
  select: typeof cartWithLinesSelect;
}>;

export interface CreateOrderData {
  users_id: number;
  user_addresses_id: number;
  coupons_id: number | null;
  subtotal: Prisma.Decimal;
  discount_amount: Prisma.Decimal;
  shipping_fee: Prisma.Decimal;
  tax_amount: Prisma.Decimal;
  total_amount: Prisma.Decimal;
  notes: string | null;
  placed_at: Date;
}

export interface CreateShipmentData {
  orders_id: number;
  recipient_name: string;
  phone_number: string;
  country: string;
  state: string | null;
  city: string;
  address_1: string;
  address_2: string | null;
  postal_code: string | null;
}

export interface CreatePaymentData {
  orders_id: number;
  users_id: number;
  amount: Prisma.Decimal;
  payment_method: string;
  transaction_reference: string;
  paid_at: Date;
}

export interface OrderListFilters {
  status?: order_status;
  search?: string;
  placed_from?: string;
  placed_to?: string;
}

export type AdminOrderSortField =
  | "placed_at"
  | "order_number"
  | "total_amount"
  | "customer_name";

export type AdminOrderSortDirection = "asc" | "desc";

export interface AdminListRowRaw {
  public_id: string;
  order_number: string;
  status: string;
  placed_at: Date;
  subtotal: Prisma.Decimal;
  discount_amount: Prisma.Decimal;
  shipping_fee: Prisma.Decimal;
  tax_amount: Prisma.Decimal;
  total_amount: Prisma.Decimal;
  customer_public_id: string;
  customer_name: string;
  customer_email: string;
  created_at: Date;
  updated_at: Date;
}

// Raw SQL fragments. The admin list joins `orders` to `users` and computes the
// derived `customer_name` expression, which cannot be expressed with Prisma's
// typed where/orderBy inputs. Identifiers are schema-qualified because the
// adapter only qualifies generated queries.
const ordersTable = Prisma.raw(`"${dbSchema}"."orders"`);
const usersTable = Prisma.raw(`"${dbSchema}"."users"`);
const inventoryTable = Prisma.raw(`"${dbSchema}"."inventory"`);

const adminFromJoins = Prisma.sql`
  FROM ${ordersTable} o
  JOIN ${usersTable} u ON u.id = o.users_id
`;

const adminSortColumns: Record<AdminOrderSortField, string> = {
  placed_at: "o.placed_at",
  order_number: "o.order_number",
  total_amount: "o.total_amount",
  customer_name: "(u.first_name || ' ' || u.last_name)",
};

function buildAdminWhere(filters: OrderListFilters): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];

  if (filters.status) {
    conditions.push(Prisma.sql`o.status = ${filters.status}`);
  }

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(
      Prisma.sql`(o.order_number ILIKE ${pattern} OR (u.first_name || ' ' || u.last_name) ILIKE ${pattern} OR u.email ILIKE ${pattern})`,
    );
  }

  if (filters.placed_from) {
    conditions.push(
      Prisma.sql`o.placed_at >= ${filters.placed_from}::timestamptz`,
    );
  }

  if (filters.placed_to) {
    conditions.push(Prisma.sql`o.placed_at <= ${filters.placed_to}::timestamptz`);
  }

  if (conditions.length === 0) {
    return Prisma.empty;
  }

  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
}

function buildAdminOrderBy(
  field: AdminOrderSortField,
  direction: AdminOrderSortDirection,
): Prisma.Sql {
  const column = adminSortColumns[field];
  const sqlDirection = direction === "desc" ? "DESC" : "ASC";
  return Prisma.sql`ORDER BY ${Prisma.raw(column)} ${Prisma.raw(sqlDirection)}, o.id ASC`;
}

export const ordersRepository = {
  findCartWithLinesByUserId(users_id: number, client: DbClient = prisma) {
    return client.carts.findFirst({
      where: { users_id },
      select: cartWithLinesSelect,
    });
  },

  findAddressByPublicIdAndUserId(
    address_public_id: string,
    users_id: number,
    client: DbClient = prisma,
  ) {
    return client.user_addresses.findFirst({
      where: {
        public_id: address_public_id,
        users_id,
        deleted_at: null,
      },
    });
  },

  findCouponByCode(code: string, client: DbClient = prisma) {
    return client.coupons.findUnique({
      where: { code },
    });
  },

  countCouponUsagesByUser(
    coupons_id: number,
    users_id: number,
    client: DbClient = prisma,
  ) {
    return client.coupon_usages.count({
      where: { coupons_id, users_id },
    });
  },

  incrementCouponUsage(coupons_id: number, client: DbClient = prisma) {
    return client.coupons.update({
      where: { id: coupons_id },
      data: { usage_count: { increment: 1 }, updated_at: new Date() },
      select: { id: true },
    });
  },

  createCouponUsage(
    data: {
      orders_id: number;
      coupons_id: number;
      users_id: number;
      discount_amount: Prisma.Decimal;
      redeemed_at: Date;
    },
    client: DbClient = prisma,
  ) {
    return client.coupon_usages.create({
      data: {
        orders_id: data.orders_id,
        coupons_id: data.coupons_id,
        users_id: data.users_id,
        discount_amount: data.discount_amount,
        redeemed_at: data.redeemed_at,
      },
      select: { id: true },
    });
  },

  createOrder(data: CreateOrderData, client: DbClient = prisma) {
    const now = new Date();
    const public_id = generatePublicId(PUBLIC_ID_PREFIXES.ORDER);
    return client.orders.create({
      data: {
        public_id,
        order_number: public_id,
        users_id: data.users_id,
        user_addresses_id: data.user_addresses_id,
        coupons_id: data.coupons_id,
        status: order_status.PENDING,
        shipping_cost: data.shipping_fee,
        subtotal: data.subtotal,
        discount_amount: data.discount_amount,
        shipping_fee: data.shipping_fee,
        tax_amount: data.tax_amount,
        total_amount: data.total_amount,
        notes: data.notes,
        placed_at: data.placed_at,
        created_at: now,
        updated_at: now,
      },
      select: { id: true, public_id: true },
    });
  },

  updateOrderNumber(
    id: number,
    order_number: string,
    client: DbClient = prisma,
  ) {
    return client.orders.update({
      where: { id },
      data: { order_number, updated_at: new Date() },
      select: { id: true },
    });
  },

  createShipment(data: CreateShipmentData, client: DbClient = prisma) {
    const now = new Date();
    return client.shipments.create({
      data: {
        public_id: generatePublicId(PUBLIC_ID_PREFIXES.SHIPMENT),
        status: "pending",
        orders_id: data.orders_id,
        recipient_name: data.recipient_name,
        phone_number: data.phone_number,
        country: data.country,
        state: data.state,
        city: data.city,
        address_1: data.address_1,
        address_2: data.address_2,
        postal_code: data.postal_code,
        created_at: now,
        updated_at: now,
      },
      select: { id: true },
    });
  },

  createOrderItems(
    items: Prisma.order_itemsUncheckedCreateInput[],
    client: DbClient = prisma,
  ) {
    return client.order_items.createMany({ data: items });
  },

  createPayment(data: CreatePaymentData, client: DbClient = prisma) {
    const now = new Date();
    return client.payments.create({
      data: {
        public_id: generatePublicId(PUBLIC_ID_PREFIXES.PAYMENT),
        amount: data.amount,
        payment_method: data.payment_method,
        status: payment_status.PAID,
        transaction_reference: data.transaction_reference,
        paid_at: data.paid_at,
        users_id: data.users_id,
        orders_id: data.orders_id,
        created_at: now,
        updated_at: now,
      },
      select: { id: true },
    });
  },

  reserveStock(
    product_variants_id: number,
    quantity: number,
    client: DbClient = prisma,
  ) {
    return client.$executeRaw`
      UPDATE ${inventoryTable}
      SET quantity_reserved = COALESCE(quantity_reserved, 0) + ${quantity},
          last_stock_update = now()
      WHERE product_variants_id = ${product_variants_id}
        AND (quantity_on_hand - COALESCE(quantity_reserved, 0)) >= ${quantity}
    `;
  },

  commitStock(
    product_variants_id: number,
    quantity: number,
    client: DbClient = prisma,
  ) {
    return client.$executeRaw`
      UPDATE ${inventoryTable}
      SET quantity_on_hand = quantity_on_hand - ${quantity},
          quantity_reserved = quantity_reserved - ${quantity},
          last_stock_update = now()
      WHERE product_variants_id = ${product_variants_id}
        AND quantity_on_hand >= ${quantity}
        AND COALESCE(quantity_reserved, 0) >= ${quantity}
    `;
  },

  releaseStock(
    product_variants_id: number,
    quantity: number,
    client: DbClient = prisma,
  ) {
    return client.$executeRaw`
      UPDATE ${inventoryTable}
      SET quantity_reserved = quantity_reserved - ${quantity},
          last_stock_update = now()
      WHERE product_variants_id = ${product_variants_id}
        AND COALESCE(quantity_reserved, 0) >= ${quantity}
    `;
  },

  updateOrderStatus(
    id: number,
    status: order_status,
    updated_at: Date,
    client: DbClient = prisma,
  ) {
    return client.orders.update({
      where: { id },
      data: { status, updated_at },
      select: { id: true },
    });
  },

  markPaymentPaid(
    orders_id: number,
    paid_at: Date,
    client: DbClient = prisma,
  ) {
    return client.payments.updateMany({
      where: { orders_id, status: payment_status.PENDING },
      data: { status: payment_status.PAID, paid_at, updated_at: new Date() },
    });
  },

  markPaymentRefunded(
    orders_id: number,
    refunded_at: Date,
    client: DbClient = prisma,
  ) {
    return client.payments.updateMany({
      where: { orders_id },
      data: {
        status: payment_status.REFUNDED,
        refunded_at,
        updated_at: new Date(),
      },
    });
  },

  updateShipmentShipped(
    orders_id: number,
    carrier: string,
    tracking_number: string | null,
    shipped_at: Date,
    client: DbClient = prisma,
  ) {
    return client.shipments.updateMany({
      where: { orders_id },
      data: {
        status: "shipped",
        carrier,
        tracking_number,
        shipped_at,
        updated_at: new Date(),
      },
    });
  },

  updateShipmentDelivered(
    orders_id: number,
    delivered_at: Date,
    client: DbClient = prisma,
  ) {
    return client.shipments.updateMany({
      where: { orders_id },
      data: {
        status: "delivered",
        delivered_at,
        updated_at: new Date(),
      },
    });
  },

  deleteCartLines(carts_id: number, client: DbClient = prisma) {
    return client.cart_items.deleteMany({ where: { carts_id } });
  },

  deleteCart(carts_id: number, client: DbClient = prisma) {
    return client.carts.delete({ where: { id: carts_id } });
  },

  findOrderById(id: number, client: DbClient = prisma) {
    return client.orders.findUnique({
      where: { id },
      select: customerOrderSelect,
    });
  },

  findOrderByPublicIdAndUserId(
    public_id: string,
    users_id: number,
    client: DbClient = prisma,
  ) {
    return client.orders.findFirst({
      where: { public_id, users_id },
      select: customerOrderSelect,
    });
  },

  findOrderByPublicId(public_id: string, client: DbClient = prisma) {
    return client.orders.findFirst({
      where: { public_id },
      select: adminOrderSelect,
    });
  },

  listOrdersByUser(
    users_id: number,
    status: order_status | undefined,
    orderBy: Prisma.ordersOrderByWithRelationInput,
    skip: number,
    take: number,
  ) {
    return prisma.orders.findMany({
      where: { users_id, ...(status ? { status } : {}) },
      orderBy,
      skip,
      take,
      select: customerOrderSelect,
    });
  },

  countOrdersByUser(users_id: number, status: order_status | undefined) {
    return prisma.orders.count({
      where: { users_id, ...(status ? { status } : {}) },
    });
  },

  listAdminOrders(
    filters: OrderListFilters,
    sortField: AdminOrderSortField,
    sortDirection: AdminOrderSortDirection,
    skip: number,
    take: number,
  ) {
    return prisma.$queryRaw<AdminListRowRaw[]>`
      SELECT
        o.public_id AS public_id,
        o.order_number AS order_number,
        o.status AS status,
        o.placed_at AS placed_at,
        o.subtotal AS subtotal,
        o.discount_amount AS discount_amount,
        o.shipping_fee AS shipping_fee,
        o.tax_amount AS tax_amount,
        o.total_amount AS total_amount,
        u.public_id AS customer_public_id,
        (u.first_name || ' ' || u.last_name) AS customer_name,
        u.email AS customer_email,
        o.created_at AS created_at,
        o.updated_at AS updated_at
      ${adminFromJoins}
      ${buildAdminWhere(filters)}
      ${buildAdminOrderBy(sortField, sortDirection)}
      LIMIT ${take} OFFSET ${skip}
    `;
  },

  async countAdminOrders(filters: OrderListFilters) {
    const rows = await prisma.$queryRaw<{ total: number }[]>`
      SELECT count(*)::int AS total
      ${adminFromJoins}
      ${buildAdminWhere(filters)}
    `;
    return rows[0]?.total ?? 0;
  },
};
