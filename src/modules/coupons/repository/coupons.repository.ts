import { dbSchema, prisma } from "../../../config/database.js";
import { Prisma } from "../../../generated/prisma/client.js";
import type { CouponStatus } from "../validators/admin.js";
import { escapeLikePattern } from "../../../shared/utils/index.js";

// The list query derives status from time/usage comparisons that exceed
// Prisma's typed where inputs, so raw SQL is used with schema-qualified
// identifiers (the adapter only qualifies generated queries).
const couponsTable = Prisma.raw(`"${dbSchema}"."coupons"`);
const couponUsagesTable = Prisma.raw(`"${dbSchema}"."coupon_usages"`);
const ordersTable = Prisma.raw(`"${dbSchema}"."orders"`);
const usersTable = Prisma.raw(`"${dbSchema}"."users"`);

export interface CouponListFilters {
  search?: string;
  status?: CouponStatus;
  includeDeleted: boolean;
}

export type CouponSortField =
  | "code"
  | "discount_value"
  | "usage_count"
  | "starts_at"
  | "expires_at"
  | "created_at";

const sortColumns: Record<CouponSortField, string> = {
  code: "c.code",
  discount_value: "c.discount_value",
  usage_count: "c.usage_count",
  starts_at: "c.starts_at",
  expires_at: "c.expires_at",
  created_at: "c.created_at",
};

function buildStatusClause(
  status: CouponStatus,
  now: Date,
): Prisma.Sql {
  switch (status) {
    case "ACTIVE":
      return Prisma.sql`c.is_active AND (c.starts_at IS NULL OR c.starts_at <= ${now}) AND (c.expires_at IS NULL OR c.expires_at > ${now}) AND c.usage_count < c.usage_limit`;
    case "INACTIVE":
      return buildInactiveClause(now);
    case "EXPIRED":
      return Prisma.sql`c.expires_at IS NOT NULL AND c.expires_at <= ${now}`;
    case "USAGE_LIMIT_REACHED":
      return Prisma.sql`c.usage_count >= c.usage_limit`;
  }
}

function buildInactiveClause(now: Date): Prisma.Sql {
  // Inactive = master switch off, or scheduled but not started yet, while not
  // already expired/exhausted.
  return Prisma.sql`(NOT c.is_active OR (c.starts_at IS NOT NULL AND c.starts_at > ${now})) AND NOT (c.expires_at IS NOT NULL AND c.expires_at <= ${now}) AND NOT (c.usage_count >= c.usage_limit)`;
}

function buildListWhere(
  filters: CouponListFilters,
  now: Date,
): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];

  if (filters.search) {
    const pattern = `${escapeLikePattern(filters.search)}%`;
    conditions.push(Prisma.sql`c.code ILIKE ${pattern} ESCAPE '\\'`);
  }

  if (filters.status) {
    conditions.push(Prisma.sql`c.deleted_at IS NULL`);
    conditions.push(buildStatusClause(filters.status, now));
  } else if (!filters.includeDeleted) {
    conditions.push(Prisma.sql`c.deleted_at IS NULL`);
  }

  if (conditions.length === 0) {
    return Prisma.empty;
  }
  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
}

export interface CouponRow {
  id: number;
  public_id: string;
  code: string;
  discount_type: "FIXED_AMOUNT" | "PERCENTAGE";
  discount_value: Prisma.Decimal;
  minimum_order_amount: Prisma.Decimal | null;
  maximum_discount_amount: Prisma.Decimal | null;
  usage_limit: number;
  usage_limit_per_user: number;
  usage_count: number;
  starts_at: Date | null;
  expires_at: Date | null;
  is_active: boolean;
  deleted_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface UsageRow {
  order_public_id: string;
  order_number: string;
  customer_public_id: string;
  customer_name: string;
  customer_email: string;
  discount_amount: Prisma.Decimal;
  redeemed_at: Date;
}

export const couponsRepository = {
  async listCoupons(
    filters: CouponListFilters,
    sortField: CouponSortField,
    descending: boolean,
    skip: number,
    take: number,
    now: Date,
  ): Promise<CouponRow[]> {
    const column = sortColumns[sortField];
    const direction = descending ? "DESC" : "ASC";
    return prisma.$queryRaw<CouponRow[]>`
      SELECT
        c.id, c.public_id, c.code, c.discount_type, c.discount_value,
        c.minimum_order_amount, c.maximum_discount_amount, c.usage_limit,
        c.usage_limit_per_user, c.usage_count, c.starts_at, c.expires_at,
        c.is_active, c.deleted_at, c.created_at, c.updated_at
      FROM ${couponsTable} c
      ${buildListWhere(filters, now)}
      ORDER BY ${Prisma.raw(column)} ${Prisma.raw(direction)}, c.id ASC
      LIMIT ${take} OFFSET ${skip}
    `;
  },

  async countCoupons(
    filters: CouponListFilters,
    now: Date,
  ): Promise<number> {
    const [row] = await prisma.$queryRaw<{ total: number }[]>`
      SELECT COUNT(*)::int AS total
      FROM ${couponsTable} c
      ${buildListWhere(filters, now)}
    `;
    return row?.total ?? 0;
  },

  findCouponByPublicId(public_id: string) {
    return prisma.coupons.findUnique({ where: { public_id } });
  },

  createCoupon(
    data: {
      public_id: string;
      code: string;
      discount_type: "FIXED_AMOUNT" | "PERCENTAGE";
      discount_value: Prisma.Decimal;
      minimum_order_amount: Prisma.Decimal | null;
      maximum_discount_amount: Prisma.Decimal | null;
      usage_limit: number;
      usage_limit_per_user: number;
      starts_at: Date | null;
      expires_at: Date | null;
      is_active: boolean;
    },
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    const now = new Date();
    return client.coupons.create({
      data: { ...data, usage_count: 0, created_at: now, updated_at: now },
    });
  },

  updateCoupon(
    id: number,
    data: Record<string, unknown>,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.coupons.update({
      where: { id },
      data: { ...data, updated_at: new Date() },
    });
  },

  softDeleteCoupon(
    id: number,
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.coupons.update({
      where: { id },
      data: { deleted_at: new Date(), is_active: false, updated_at: new Date() },
    });
  },

  async listUsages(
    coupons_id: number,
    skip: number,
    take: number,
  ): Promise<UsageRow[]> {
    return prisma.$queryRaw<UsageRow[]>`
      SELECT
        o.public_id AS order_public_id,
        o.order_number,
        u.public_id AS customer_public_id,
        (u.first_name || ' ' || u.last_name) AS customer_name,
        u.email AS customer_email,
        cu.discount_amount,
        cu.redeemed_at
      FROM ${couponUsagesTable} cu
      JOIN ${ordersTable} o ON o.id = cu.orders_id
      JOIN ${usersTable} u ON u.id = cu.users_id
      WHERE cu.coupons_id = ${coupons_id}
      ORDER BY cu.redeemed_at DESC, cu.id DESC
      LIMIT ${take} OFFSET ${skip}
    `;
  },

  async countUsages(coupons_id: number): Promise<number> {
    const [row] = await prisma.$queryRaw<{ total: number }[]>`
      SELECT COUNT(*)::int AS total
      FROM ${couponUsagesTable} cu
      WHERE cu.coupons_id = ${coupons_id}
    `;
    return row?.total ?? 0;
  },
};
