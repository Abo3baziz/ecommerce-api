import { dbSchema, prisma } from "../../../config/database.js";
import { Prisma } from "../../../generated/prisma/client.js";
import type { StockStatus } from "../utils/stock.js";

type DbClient = Prisma.TransactionClient | typeof prisma;

export interface InventoryListFilters {
  search?: string;
  stock_status?: StockStatus;
  include_deleted: boolean;
}

export type InventorySortField =
  | "product_name"
  | "sku"
  | "quantity_on_hand"
  | "quantity_available"
  | "last_stock_update";

export type InventorySortDirection = "asc" | "desc";

export interface CreateInventoryData {
  product_variants_id: number;
  quantity_on_hand: number;
  reorder_level: number | null;
}

export type UpdateInventoryData = Prisma.inventoryUpdateManyMutationInput & {
  last_stock_update: Date;
};

export interface InventoryListRow {
  public_id: string;
  product_public_id: string;
  product_name: string;
  sku: string;
  barcode: string | null;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  reorder_level: number | null;
  created_at: Date;
  last_stock_update: Date;
}

const inventoryWithVariantSelect = {
  id: true,
  product_variants_id: true,
  quantity_on_hand: true,
  reorder_level: true,
  quantity_reserved: true,
  created_at: true,
  last_stock_update: true,
  product_variants: {
    select: {
      public_id: true,
      sku: true,
      barcode: true,
      products: {
        select: {
          public_id: true,
          name: true,
        },
      },
    },
  },
} as const;

export type InventoryWithVariantRow = Prisma.inventoryGetPayload<{
  select: typeof inventoryWithVariantSelect;
}>;

// Raw SQL fragments. The `inventory` table has no public key of its own, and the
// derived fields (`quantity_available`, `stock_status`) cannot be expressed with
// Prisma's typed where/orderBy inputs, so the list query joins the variant and
// product tables and computes the derived expression in SQL. Identifiers are
// schema-qualified because the adapter only qualifies generated queries.
const inventoryTable = Prisma.raw(`"${dbSchema}"."inventory"`);
const variantsTable = Prisma.raw(`"${dbSchema}"."product_variants"`);
const productsTable = Prisma.raw(`"${dbSchema}"."products"`);

const fromJoins = Prisma.sql`
  FROM ${inventoryTable} i
  JOIN ${variantsTable} v ON v.id = i.product_variants_id
  JOIN ${productsTable} p ON p.id = v.products_id
`;

const quantityAvailableExpr = Prisma.sql`(i.quantity_on_hand - COALESCE(i.quantity_reserved, 0))`;

const inventorySortColumns: Record<InventorySortField, string> = {
  product_name: "p.name",
  sku: "v.sku",
  quantity_on_hand: "i.quantity_on_hand",
  quantity_available: "(i.quantity_on_hand - COALESCE(i.quantity_reserved, 0))",
  last_stock_update: "i.last_stock_update",
};

function buildStockStatusSql(status: StockStatus): Prisma.Sql {
  switch (status) {
    case "OUT_OF_STOCK":
      return Prisma.sql`${quantityAvailableExpr} <= 0`;
    case "LOW_STOCK":
      return Prisma.sql`${quantityAvailableExpr} > 0 AND i.reorder_level IS NOT NULL AND ${quantityAvailableExpr} <= i.reorder_level`;
    case "IN_STOCK":
      return Prisma.sql`${quantityAvailableExpr} > 0 AND (i.reorder_level IS NULL OR ${quantityAvailableExpr} > i.reorder_level)`;
  }
}

function buildListWhere(filters: InventoryListFilters): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];

  if (!filters.include_deleted) {
    conditions.push(Prisma.sql`v.deleted_at IS NULL`);
  }

  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(
      Prisma.sql`(v.sku ILIKE ${pattern} OR v.barcode ILIKE ${pattern} OR p.name ILIKE ${pattern})`,
    );
  }

  if (filters.stock_status) {
    conditions.push(buildStockStatusSql(filters.stock_status));
  }

  if (conditions.length === 0) {
    return Prisma.empty;
  }

  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
}

function buildOrderBy(
  field: InventorySortField,
  direction: InventorySortDirection,
): Prisma.Sql {
  const column = inventorySortColumns[field];
  const sqlDirection = direction === "desc" ? "DESC" : "ASC";
  return Prisma.sql`ORDER BY ${Prisma.raw(column)} ${Prisma.raw(sqlDirection)}, i.id ASC`;
}

export const inventoryRepository = {
  findVariantIdByPublicId(public_id: string) {
    return prisma.product_variants.findFirst({
      where: {
        public_id,
        deleted_at: null,
      },
      select: { id: true },
    });
  },

  findByVariantId(variants_id: number, client: DbClient = prisma) {
    return client.inventory.findFirst({
      where: {
        product_variants_id: variants_id,
      },
      select: { id: true },
    });
  },

  createInventory(data: CreateInventoryData, client: DbClient = prisma) {
    const now = new Date();
    return client.inventory.create({
      data: {
        ...data,
        created_at: now,
        last_stock_update: now,
      },
    });
  },

  findWithVariantByVariantId(variants_id: number, client: DbClient = prisma) {
    return client.inventory.findFirst({
      where: {
        product_variants_id: variants_id,
      },
      select: inventoryWithVariantSelect,
    });
  },

  findWithVariantByPublicId(public_id: string, client: DbClient = prisma) {
    return client.inventory.findFirst({
      where: {
        product_variants: {
          public_id,
          deleted_at: null,
        },
      },
      select: inventoryWithVariantSelect,
    });
  },

  updateInventory(
    variants_id: number,
    data: UpdateInventoryData,
    minimumQuantityOnHand: number | undefined,
    client: DbClient = prisma,
  ) {
    return client.inventory.updateMany({
      where: {
        product_variants_id: variants_id,
        ...(minimumQuantityOnHand !== undefined
          ? { quantity_on_hand: { gte: minimumQuantityOnHand } }
          : {}),
      },
      data,
    });
  },

  async listInventory(
    filters: InventoryListFilters,
    sortField: InventorySortField,
    sortDirection: InventorySortDirection,
    skip: number,
    take: number,
  ) {
    return prisma.$queryRaw<InventoryListRow[]>`
      SELECT
        v.public_id AS public_id,
        p.public_id AS product_public_id,
        p.name AS product_name,
        v.sku AS sku,
        v.barcode AS barcode,
        i.quantity_on_hand AS quantity_on_hand,
        COALESCE(i.quantity_reserved, 0) AS quantity_reserved,
        ${quantityAvailableExpr} AS quantity_available,
        i.reorder_level AS reorder_level,
        i.created_at AS created_at,
        i.last_stock_update AS last_stock_update
      ${fromJoins}
      ${buildListWhere(filters)}
      ${buildOrderBy(sortField, sortDirection)}
      LIMIT ${take} OFFSET ${skip}
    `;
  },

  async countInventory(filters: InventoryListFilters) {
    const rows = await prisma.$queryRaw<{ total: number }[]>`
      SELECT count(*)::int AS total
      ${fromJoins}
      ${buildListWhere(filters)}
    `;
    return rows[0]?.total ?? 0;
  },
};
