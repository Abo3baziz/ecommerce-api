import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../config/database.js";
import { PUBLIC_ID_PREFIXES } from "../../../shared/constants/index.js";
import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import {
  formatPaginationMeta,
  generatePublicId,
} from "../../../shared/utils/index.js";
import { recordAuditEventInTx } from "../../audit/service/audit.service.js";
import type { AuditRecordInput } from "../../audit/dto/audit.js";
import {
  couponsRepository,
  type CouponRow,
} from "../repository/coupons.repository.js";
import type {
  CreateCouponBody,
  CouponStatus,
  UpdateCouponBody,
} from "../validators/admin.js";

export interface CouponActor {
  id: number;
}

export interface CouponResult extends Omit<
  CouponRow,
  "id" | "discount_value" | "minimum_order_amount" |
  "maximum_discount_amount" | "starts_at" | "expires_at" |
  "deleted_at" | "created_at" | "updated_at"
> {
  discount_value: string;
  minimum_order_amount: string | null;
  maximum_discount_amount: string | null;
  starts_at: string | null;
  expires_at: string | null;
  deleted_at: string | null;
  created_at: Date;
  updated_at: Date;
  status: CouponStatus;
}

export function deriveCouponStatus(
  coupon: Pick<
    CouponRow,
    "is_active" | "starts_at" | "expires_at" | "usage_count" | "usage_limit"
  >,
  now: Date = new Date(),
): CouponStatus {
  if (!coupon.is_active) return "INACTIVE";
  if (coupon.starts_at !== null && now < coupon.starts_at) return "INACTIVE";
  if (coupon.expires_at !== null && now > coupon.expires_at) return "EXPIRED";
  if (coupon.usage_count >= coupon.usage_limit) return "USAGE_LIMIT_REACHED";
  return "ACTIVE";
}

function toCouponResult(row: CouponRow, now: Date = new Date()): CouponResult {
  return {
    public_id: row.public_id,
    code: row.code,
    discount_type: row.discount_type,
    discount_value: new Prisma.Decimal(row.discount_value).toString(),
    minimum_order_amount:
      row.minimum_order_amount === null
        ? null
        : new Prisma.Decimal(row.minimum_order_amount).toString(),
    maximum_discount_amount:
      row.maximum_discount_amount === null
        ? null
        : new Prisma.Decimal(row.maximum_discount_amount).toString(),
    usage_limit: row.usage_limit,
    usage_limit_per_user: row.usage_limit_per_user,
    usage_count: row.usage_count,
    starts_at: row.starts_at?.toISOString() ?? null,
    expires_at: row.expires_at?.toISOString() ?? null,
    is_active: row.is_active,
    deleted_at: row.deleted_at?.toISOString() ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    status: deriveCouponStatus(row, now),
  };
}

function decimal(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function buildCreateData(input: CreateCouponBody) {
  return {
    public_id: generatePublicId(PUBLIC_ID_PREFIXES.COUPON),
    code: input.code,
    discount_type: input.discount_type,
    discount_value: decimal(input.discount_value),
    minimum_order_amount:
      input.minimum_order_amount === undefined
        ? null
        : decimal(input.minimum_order_amount),
    maximum_discount_amount:
      input.maximum_discount_amount === undefined
        ? null
        : decimal(input.maximum_discount_amount),
    usage_limit: input.usage_limit,
    usage_limit_per_user: input.usage_limit_per_user,
    starts_at: input.starts_at ?? null,
    expires_at: input.expires_at ?? null,
    is_active: input.is_active,
  };
}

const COUPON_ENTITY = { entityType: "coupon" } as const;

function auditInput(
  overrides: Partial<AuditRecordInput> & Pick<AuditRecordInput, "action">,
): AuditRecordInput {
  return { statusCode: 200, ...COUPON_ENTITY, ...overrides };
}

export async function listCoupons(
  page: number,
  limit: number,
  filters: {
    search?: string;
    status?: CouponStatus;
    includeDeleted: boolean;
  },
  sort: string,
): Promise<{ coupons: CouponResult[]; pagination: ReturnType<typeof formatPaginationMeta> }> {
  const now = new Date();
  const descending = sort.startsWith("-");
  const sortField = (descending ? sort.slice(1) : sort) as Parameters<
    typeof couponsRepository.listCoupons
  >[1];

  const [rows, total] = await Promise.all([
    couponsRepository.listCoupons(
      filters,
      sortField,
      descending,
      (page - 1) * limit,
      limit,
      now,
    ),
    couponsRepository.countCoupons(filters, now),
  ]);

  return {
    coupons: rows.map((row) => toCouponResult(row, now)),
    pagination: formatPaginationMeta(page, limit, total),
  };
}

export async function getCoupon(publicId: string): Promise<CouponResult> {
  const row = await couponsRepository.findCouponByPublicId(publicId);
  if (!row) throw new NotFoundError("Coupon not found");
  return toCouponResult(row);
}

export async function getUsageHistory(
  publicId: string,
  page: number,
  limit: number,
): Promise<{
  usages: Awaited<ReturnType<typeof couponsRepository.listUsages>>;
  pagination: ReturnType<typeof formatPaginationMeta>;
}> {
  const coupon = await couponsRepository.findCouponByPublicId(publicId);
  if (!coupon) throw new NotFoundError("Coupon not found");

  const [rows, total] = await Promise.all([
    couponsRepository.listUsages(coupon.id, (page - 1) * limit, limit),
    couponsRepository.countUsages(coupon.id),
  ]);

  return {
    usages: rows,
    pagination: formatPaginationMeta(page, limit, total),
  };
}

export async function createCoupon(
  input: CreateCouponBody,
  actor: CouponActor,
): Promise<CouponResult> {
  try {
    const created = await prisma.$transaction(async (tx) => {
      const row = await couponsRepository.createCoupon(buildCreateData(input), tx);
      await recordAuditEventInTx(tx,
        auditInput({
          action: "admin.coupons.create",
          entityPublicId: row.public_id,
          actorUsersId: actor.id,
          statusCode: 201,
          requestBody: toCouponResult(row as CouponRow),
        }),
      );
      return row;
    });
    return toCouponResult(created as CouponRow);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictError("Coupon code already exists");
    }
    throw error;
  }
}

function buildUpdateData(input: UpdateCouponBody): Record<string, unknown> {
  const data: Record<string, unknown> = {};
  if (input.code !== undefined) data.code = input.code;
  if (input.discount_type !== undefined) data.discount_type = input.discount_type;
  if (input.discount_value !== undefined)
    data.discount_value = decimal(input.discount_value);
  if (input.minimum_order_amount !== undefined)
    data.minimum_order_amount =
      input.minimum_order_amount === null ? null : decimal(input.minimum_order_amount);
  if (input.maximum_discount_amount !== undefined)
    data.maximum_discount_amount =
      input.maximum_discount_amount === null
        ? null
        : decimal(input.maximum_discount_amount);
  if (input.usage_limit !== undefined) data.usage_limit = input.usage_limit;
  if (input.usage_limit_per_user !== undefined)
    data.usage_limit_per_user = input.usage_limit_per_user;
  if (input.starts_at !== undefined) data.starts_at = input.starts_at ?? null;
  if (input.expires_at !== undefined) data.expires_at = input.expires_at ?? null;
  if (input.is_active !== undefined) data.is_active = input.is_active;
  return data;
}

function buildChanges(
  previous: CouponRow,
  data: Record<string, unknown>,
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [field, to] of Object.entries(data)) {
    const from = (previous as unknown as Record<string, unknown>)[field];
    if (from instanceof Date || to instanceof Date) {
      const fromIso = from instanceof Date ? from.toISOString() : from;
      const toIso = to instanceof Date ? to.toISOString() : to;
      if (fromIso !== toIso) changes[field] = { from: fromIso, to: toIso };
      continue;
    }
    // eslint-disable-next-line eqeqeq
    if (from != to) changes[field] = { from, to };
  }
  return changes;
}

export async function updateCoupon(
  publicId: string,
  input: UpdateCouponBody,
  actor: CouponActor,
): Promise<CouponResult> {
  const existing = await couponsRepository.findCouponByPublicId(publicId);
  if (!existing) throw new NotFoundError("Coupon not found");

  if (
    existing.deleted_at !== null ||
    (existing.usage_count > 0 &&
      input.code !== undefined &&
      input.code !== existing.code)
  ) {
    throw new ConflictError(
      "The coupon code cannot be changed after it has been redeemed",
    );
  }

  const data = buildUpdateData(input);

  // Cross-field date check when either bound changes.
  const nextStarts = (data.starts_at as Date | null | undefined) ?? existing.starts_at;
  const nextExpires = (data.expires_at as Date | null | undefined) ?? existing.expires_at;
  if (
    nextStarts !== null &&
    nextStarts !== undefined &&
    nextExpires !== null &&
    nextExpires !== undefined &&
    nextExpires <= nextStarts
  ) {
    throw new ConflictError("expires_at must be after starts_at");
  }

  const changes = buildChanges(existing, data);
  const onlyStatusToggle =
    Object.keys(changes).length > 0 && Object.keys(data).length === 1 && input.is_active !== undefined;

  const updated = await prisma.$transaction(async (tx) => {
    const row = (await couponsRepository.updateCoupon(existing.id, data, tx)) as CouponRow;
    await recordAuditEventInTx(tx,
      auditInput({
        action: onlyStatusToggle
          ? "admin.coupons.status_change"
          : "admin.coupons.update",
        entityPublicId: existing.public_id,
        actorUsersId: actor.id,
        requestBody: data,
        changes,
        previousValues: existing,
      }),
    );
    return row;
  });

  return toCouponResult(updated);
}

export async function deleteCoupon(
  publicId: string,
  actor: CouponActor,
): Promise<void> {
  const existing = await couponsRepository.findCouponByPublicId(publicId);
  if (!existing) throw new NotFoundError("Coupon not found");
  if (existing.deleted_at !== null) {
    throw new ConflictError("Coupon is already deleted");
  }

  await prisma.$transaction(async (tx) => {
    await couponsRepository.softDeleteCoupon(existing.id, tx);
    await recordAuditEventInTx(tx,
      auditInput({
        action: "admin.coupons.delete",
        entityPublicId: existing.public_id,
        actorUsersId: actor.id,
        statusCode: 204,
        previousValues: existing,
      }),
    );
  });
}

// Re-exported for the orders module's redemption/release audit hooks.
export { recordAuditEventInTx };
