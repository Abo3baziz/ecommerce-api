import { prisma } from "../../../config/database.js";
import { Prisma } from "../../../generated/prisma/client.js";
import type { user_role } from "../../../generated/prisma/enums.js";
import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import { logger } from "../../../shared/logger/index.js";
import { formatPaginationMeta } from "../../../shared/utils/index.js";
import type {
  CreateInventoryInput,
  InventoryResult,
  ListInventoryResult,
  UpdateInventoryInput,
} from "../dto/inventory.js";
import {
  inventoryRepository,
  type InventoryListFilters,
  type InventoryListRow,
  type InventorySortDirection,
  type InventorySortField,
  type InventoryWithVariantRow,
  type UpdateInventoryData,
} from "../repository/inventory.repository.js";
import { computeQuantityAvailable, computeStockStatus } from "../utils/stock.js";
import { parseSort } from "../utils/sort.js";
import type { StockStatus } from "../utils/stock.js";

export interface InventoryActor {
  id: number;
  role: user_role;
}

function toInventoryResult(row: InventoryWithVariantRow): InventoryResult {
  const quantityReserved = row.quantity_reserved ?? 0;
  const quantityAvailable = computeQuantityAvailable(
    row.quantity_on_hand,
    quantityReserved,
  );

  return {
    public_id: row.product_variants.public_id,
    product_public_id: row.product_variants.products.public_id,
    product_name: row.product_variants.products.name,
    sku: row.product_variants.sku,
    barcode: row.product_variants.barcode,
    quantity_on_hand: row.quantity_on_hand,
    quantity_reserved: quantityReserved,
    quantity_available: quantityAvailable,
    reorder_level: row.reorder_level,
    stock_status: computeStockStatus(quantityAvailable, row.reorder_level),
    created_at: row.created_at,
    last_stock_update: row.last_stock_update,
  };
}

function toInventoryResultFromListRow(row: InventoryListRow): InventoryResult {
  return {
    public_id: row.public_id,
    product_public_id: row.product_public_id,
    product_name: row.product_name,
    sku: row.sku,
    barcode: row.barcode,
    quantity_on_hand: row.quantity_on_hand,
    quantity_reserved: row.quantity_reserved,
    quantity_available: row.quantity_available,
    reorder_level: row.reorder_level,
    stock_status: computeStockStatus(row.quantity_available, row.reorder_level),
    created_at: row.created_at,
    last_stock_update: row.last_stock_update,
  };
}

export async function listInventory(
  page: number,
  limit: number,
  search: string | undefined,
  stockStatus: StockStatus | undefined,
  includeDeleted: boolean,
  sort: string,
): Promise<ListInventoryResult> {
  const { field, direction } = parseSort(sort);
  const filters: InventoryListFilters = {
    search,
    stock_status: stockStatus,
    include_deleted: includeDeleted,
  };

  const [rows, total] = await Promise.all([
    inventoryRepository.listInventory(
      filters,
      field as InventorySortField,
      direction as InventorySortDirection,
      (page - 1) * limit,
      limit,
    ),
    inventoryRepository.countInventory(filters),
  ]);

  return {
    inventory: rows.map(toInventoryResultFromListRow),
    pagination: formatPaginationMeta(page, limit, total),
  };
}

export async function getInventory(
  variantPublicId: string,
): Promise<InventoryResult> {
  const row = await inventoryRepository.findWithVariantByPublicId(variantPublicId);

  if (!row) {
    throw new NotFoundError("Inventory record not found");
  }

  return toInventoryResult(row);
}

export async function createInventory(
  input: CreateInventoryInput,
): Promise<InventoryResult> {
  const variant = await inventoryRepository.findVariantIdByPublicId(
    input.variant_public_id,
  );

  if (!variant) {
    throw new NotFoundError("Variant not found");
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const existing = await inventoryRepository.findByVariantId(variant.id, tx);

      if (existing) {
        throw new ConflictError(
          "A variant with this public ID already has an inventory record.",
        );
      }

      await inventoryRepository.createInventory(
        {
          product_variants_id: variant.id,
          quantity_on_hand: input.quantity_on_hand,
          reorder_level: input.reorder_level ?? null,
        },
        tx,
      );

      const row = await inventoryRepository.findWithVariantByVariantId(
        variant.id,
        tx,
      );
      return row!;
    });

    return toInventoryResult(created);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictError(
        "A variant with this public ID already has an inventory record.",
      );
    }
    throw error;
  }
}

export async function updateInventory(
  variantPublicId: string,
  input: UpdateInventoryInput,
  actor: InventoryActor,
): Promise<InventoryResult> {
  const row = await inventoryRepository.findWithVariantByPublicId(variantPublicId);

  if (!row) {
    throw new NotFoundError("Inventory record not found");
  }

  const data: UpdateInventoryData = {
    last_stock_update: new Date(),
  };
  let minimumQuantityOnHand: number | undefined;

  if (input.quantity_on_hand !== undefined) {
    data.quantity_on_hand = input.quantity_on_hand;
  } else if (input.quantity_change !== undefined) {
    data.quantity_on_hand = { increment: input.quantity_change };

    if (input.quantity_change < 0) {
      minimumQuantityOnHand = -input.quantity_change;
    }
  }

  if (input.reorder_level !== undefined) {
    data.reorder_level = input.reorder_level;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await inventoryRepository.updateInventory(
      row.product_variants_id,
      data,
      minimumQuantityOnHand,
      tx,
    );

    if (result.count === 0) {
      throw new ConflictError(
        "quantity_change would drive quantity_on_hand below zero",
      );
    }

    const updatedRow = await inventoryRepository.findWithVariantByVariantId(
      row.product_variants_id,
      tx,
    );
    return updatedRow!;
  });

  logger.info(
    {
      actorId: actor.id,
      variantPublicId,
      previousQuantityOnHand: row.quantity_on_hand,
      nextQuantityOnHand: updated.quantity_on_hand,
      reason: input.reason ?? null,
    },
    "Inventory adjusted",
  );

  return toInventoryResult(updated);
}
