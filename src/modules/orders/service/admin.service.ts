import { prisma } from "../../../config/database.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { order_status } from "../../../generated/prisma/enums.js";
import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import { logger } from "../../../shared/logger/index.js";
import { formatPaginationMeta } from "../../../shared/utils/index.js";
import {
  ordersRepository,
  type AdminListRowRaw,
  type AdminOrderRow,
  type AdminOrderSortDirection,
  type AdminOrderSortField,
  type OrderListFilters,
} from "../repository/orders.repository.js";
import { parseSort } from "../utils/sort.js";
import { toOrderResult, toOrderStatusEnum } from "./orders.service.js";
import type {
  AdminOrderResult,
  AdminListOrderRow,
  ListAdminOrdersQuery,
  ListAdminOrdersResult,
  UpdateOrderStatusBody,
} from "../dto/orders.js";

const ALLOWED_TRANSITIONS: Record<order_status, readonly order_status[]> = {
  [order_status.PENDING]: [order_status.CONFIRMED, order_status.CANCELLED],
  [order_status.CONFIRMED]: [order_status.PROCESSING, order_status.CANCELLED],
  [order_status.PROCESSING]: [order_status.SHIPPED, order_status.CANCELLED],
  [order_status.SHIPPED]: [order_status.DELIVERED],
  [order_status.DELIVERED]: [order_status.RETURNED],
  [order_status.RETURNED]: [order_status.REFUNDED],
  [order_status.CANCELLED]: [],
  [order_status.REFUNDED]: [],
};

function toAdminOrderResult(row: AdminOrderRow): AdminOrderResult {
  const shipment = row.shipments!;

  return {
    ...toOrderResult(row),
    shipment: {
      public_id: shipment.public_id,
      status: shipment.status,
      carrier: shipment.carrier,
      tracking_number: shipment.tracking_number,
      shipped_at: shipment.shipped_at,
      delivered_at: shipment.delivered_at,
    },
    customer_public_id: row.users.public_id,
    customer_name: `${row.users.first_name} ${row.users.last_name}`,
    customer_email: row.users.email,
    customer_phone_number: row.users.phone_number,
  };
}

function toAdminListRow(row: AdminListRowRaw): AdminListOrderRow {
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
    customer_public_id: row.customer_public_id,
    customer_name: row.customer_name,
    customer_email: row.customer_email,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listAdminOrders(
  query: ListAdminOrdersQuery,
): Promise<ListAdminOrdersResult> {
  const { field, direction } = parseSort(query.sort);
  const filters: OrderListFilters = {
    status: query.status ? toOrderStatusEnum(query.status) : undefined,
    search: query.search,
    placed_from: query.placed_from,
    placed_to: query.placed_to,
  };

  const [rows, total] = await Promise.all([
    ordersRepository.listAdminOrders(
      filters,
      field as AdminOrderSortField,
      direction as AdminOrderSortDirection,
      (query.page - 1) * query.limit,
      query.limit,
    ),
    ordersRepository.countAdminOrders(filters),
  ]);

  return {
    orders: rows.map(toAdminListRow),
    pagination: formatPaginationMeta(query.page, query.limit, total),
  };
}

export async function getAdminOrder(
  orderPublicId: string,
): Promise<AdminOrderResult> {
  const row = await ordersRepository.findOrderByPublicId(orderPublicId);

  if (!row) {
    throw new NotFoundError("Order not found");
  }

  return toAdminOrderResult(row);
}

export interface OrderStatusActor {
  id: number;
}

async function restockOrderLines(
  order: AdminOrderRow,
  tx: Prisma.TransactionClient,
): Promise<void> {
  for (const line of order.order_items) {
    const affected = await ordersRepository.restockStock(
      line.product_variants_id,
      line.quantity,
      tx,
    );
    if (affected === 0) {
      throw new ConflictError(
        "Inventory record not found for one or more order items",
      );
    }
  }
}

export async function updateOrderStatus(
  orderPublicId: string,
  input: UpdateOrderStatusBody,
  actor: OrderStatusActor,
): Promise<AdminOrderResult> {
  const to = toOrderStatusEnum(input.status);

  const { order: updated, from: priorStatus } =
    await prisma.$transaction(async (tx) => {
    const locked = await ordersRepository.lockOrderByPublicId(
      orderPublicId,
      tx,
    );
    if (locked.length === 0) {
      throw new NotFoundError("Order not found");
    }

    const order = await ordersRepository.findOrderByPublicId(orderPublicId, tx);

    if (order === null) {
      throw new NotFoundError("Order not found");
    }

    const from = order.status;

    if (from === to) {
      throw new ConflictError(
        `Order ${orderPublicId} is already in status ${input.status}`,
      );
    }

    if (!ALLOWED_TRANSITIONS[from].includes(to)) {
      throw new ConflictError(
        `Order ${orderPublicId} cannot transition from ${from.toLowerCase()} to ${input.status}.`,
      );
    }

    const now = new Date();

    switch (to) {
      case order_status.CONFIRMED: {
        await ordersRepository.markPaymentPaid(order.id, now, tx);
        for (const line of order.order_items) {
          await ordersRepository.commitStock(
            line.product_variants_id,
            line.quantity,
            tx,
          );
        }
        break;
      }
      case order_status.CANCELLED: {
        if (from === order_status.PENDING) {
          for (const line of order.order_items) {
            await ordersRepository.releaseStock(
              line.product_variants_id,
              line.quantity,
              tx,
            );
          }
        } else {
          await ordersRepository.markPaymentRefunded(order.id, now, tx);
          await restockOrderLines(order, tx);
        }
        await ordersRepository.restoreCouponUsage(order.id, tx);
        break;
      }
      case order_status.SHIPPED: {
        await ordersRepository.updateShipmentShipped(
          order.id,
          input.carrier!,
          input.tracking_number ?? null,
          now,
          tx,
        );
        break;
      }
      case order_status.DELIVERED: {
        await ordersRepository.updateShipmentDelivered(order.id, now, tx);
        break;
      }
      case order_status.REFUNDED: {
        await ordersRepository.markPaymentRefunded(order.id, now, tx);
        await restockOrderLines(order, tx);
        break;
      }
      default:
        break;
    }

    await ordersRepository.updateOrderStatus(order.id, to, now, tx);

    const refreshed = await ordersRepository.findOrderByPublicId(
      orderPublicId,
      tx,
    );
    return { order: refreshed!, from };
  });

  const restocked =
    to === order_status.CANCELLED || to === order_status.REFUNDED;

  logger.info(
    {
      actorId: actor.id,
      orderPublicId,
      from: priorStatus.toLowerCase(),
      to: to.toLowerCase(),
    },
    "Order status changed",
  );

  if (restocked) {
    const reason =
      to === order_status.CANCELLED ? "order_cancel" : "order_refund";
    for (const line of updated.order_items) {
      logger.info(
        {
          actorId: actor.id,
          orderPublicId,
          variantPublicId: line.product_variants.public_id,
          quantity: line.quantity,
          reason,
        },
        "Inventory restocked",
      );
    }
  }

  return toAdminOrderResult(updated);
}
