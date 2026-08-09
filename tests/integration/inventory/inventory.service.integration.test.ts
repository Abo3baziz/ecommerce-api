import { describe, it, expect, beforeEach } from "vitest";
import {
  createInventory as createInventoryService,
  getInventory,
  listInventory,
  updateInventory as updateInventoryService,
} from "../../../src/modules/inventory/service/inventory.service.js";
import { ConflictError } from "../../../src/shared/errors/ConflictError.js";
import { NotFoundError } from "../../../src/shared/errors/NotFoundError.js";
import { user_role } from "../../../src/generated/prisma/enums.js";
import { prisma } from "../../../src/config/database.js";
import { createProduct } from "../../factories/product.factory.js";
import { createVariant } from "../../factories/variant.factory.js";
import { createInventory } from "../../factories/inventory.factory.js";
import { cleanupTestData } from "../../helpers/db.js";

const actor = { id: 1, role: user_role.SUPER_ADMIN };

describe("inventory.service", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("listInventory", () => {
    it("returns an empty list with pagination metadata when nothing exists", async () => {
      const result = await listInventory(1, 20, undefined, undefined, false, "product_name");

      expect(result.inventory).toEqual([]);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0,
        hasNext: false,
        hasPrev: false,
      });
    });

    it("joins variant and product data and never exposes internal ids", async () => {
      const product = await createProduct({ name: "Wireless Headphones" });
      const variant = await createVariant(product.id, { sku: "WH-1000", barcode: "0272429250045" });
      await createInventory(variant.id, { quantity_on_hand: 100, quantity_reserved: 5, reorder_level: 20 });

      const result = await listInventory(1, 20, undefined, undefined, false, "product_name");

      expect(result.inventory).toHaveLength(1);
      const item = result.inventory[0];
      expect(item.public_id).toBe(variant.public_id);
      expect(item.product_public_id).toBe(product.public_id);
      expect(item.product_name).toBe("Wireless Headphones");
      expect(item.sku).toBe("WH-1000");
      expect(item.barcode).toBe("0272429250045");
      expect(item.quantity_on_hand).toBe(100);
      expect(item.quantity_reserved).toBe(5);
      expect(item.quantity_available).toBe(95);
      expect(item.reorder_level).toBe(20);
      expect(item.stock_status).toBe("IN_STOCK");
      expect(item).not.toHaveProperty("id");
      expect(item).not.toHaveProperty("product_variants_id");
      expect(item).not.toHaveProperty("deleted_at");
    });

    it("excludes soft-deleted variants by default and includes them when requested", async () => {
      const product = await createProduct();
      const activeVariant = await createVariant(product.id);
      const deletedVariant = await createVariant(product.id, { deleted_at: new Date() });
      await createInventory(activeVariant.id);
      await createInventory(deletedVariant.id);

      const withoutDeleted = await listInventory(1, 20, undefined, undefined, false, "product_name");
      expect(withoutDeleted.inventory.map((item) => item.public_id)).toEqual([
        activeVariant.public_id,
      ]);

      const withDeleted = await listInventory(1, 20, undefined, undefined, true, "product_name");
      expect(withDeleted.inventory.map((item) => item.public_id)).toEqual(
        expect.arrayContaining([activeVariant.public_id, deletedVariant.public_id]),
      );
      expect(withDeleted.inventory).toHaveLength(2);
    });

    it("filters by search across sku, barcode, and product name case-insensitively", async () => {
      const product = await createProduct({ name: "Wireless Headphones" });
      const skuVariant = await createVariant(product.id, { sku: "WH-1000XM5" });
      const barcodeVariant = await createVariant(product.id, { barcode: "04249290045" });
      await createInventory(skuVariant.id);
      await createInventory(barcodeVariant.id);
      await createVariant(product.id, { sku: "UNRELATED" });

      const bySku = await listInventory(1, 20, "wh-1000", undefined, false, "product_name");
      expect(bySku.inventory.map((item) => item.public_id)).toEqual([skuVariant.public_id]);

      const byBarcode = await listInventory(1, 20, "04249290045", undefined, false, "product_name");
      expect(byBarcode.inventory.map((item) => item.public_id)).toEqual([barcodeVariant.public_id]);

      const byName = await listInventory(1, 20, "WIRELESS", undefined, false, "product_name");
      expect(byName.inventory).toHaveLength(2);
    });

    it("filters by the derived stock_status", async () => {
      const product = await createProduct();
      const out = await createVariant(product.id, { sku: "OUT-1" });
      const low = await createVariant(product.id, { sku: "LOW-1" });
      const inStock = await createVariant(product.id, { sku: "IN-1" });
      await createInventory(out.id, { quantity_on_hand: 0 });
      await createInventory(low.id, { quantity_on_hand: 15, reorder_level: 20 });
      await createInventory(inStock.id, { quantity_on_hand: 100, reorder_level: 20 });

      const outOfStock = await listInventory(1, 20, undefined, "OUT_OF_STOCK", false, "product_name");
      expect(outOfStock.inventory.map((item) => item.public_id)).toEqual([out.public_id]);

      const lowStock = await listInventory(1, 20, undefined, "LOW_STOCK", false, "product_name");
      expect(lowStock.inventory.map((item) => item.public_id)).toEqual([low.public_id]);

      const inStockResult = await listInventory(1, 20, undefined, "IN_STOCK", false, "product_name");
      expect(inStockResult.inventory.map((item) => item.public_id)).toEqual([inStock.public_id]);
    });

    it("treats reserved quantity as unavailable when filtering by stock_status", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);
      await createInventory(variant.id, { quantity_on_hand: 5, quantity_reserved: 5 });

      const outOfStock = await listInventory(1, 20, undefined, "OUT_OF_STOCK", false, "product_name");

      expect(outOfStock.inventory.map((item) => item.public_id)).toEqual([variant.public_id]);
      expect(outOfStock.inventory[0].stock_status).toBe("OUT_OF_STOCK");
    });

    it("sorts by the allowed fields", async () => {
      const product = await createProduct();
      const a = await createVariant(product.id, { sku: "SKU-A" });
      const b = await createVariant(product.id, { sku: "SKU-B" });
      await createInventory(a.id, { quantity_on_hand: 10 });
      await createInventory(b.id, { quantity_on_hand: 50 });

      const bySkuAsc = await listInventory(1, 20, undefined, undefined, false, "sku");
      expect(bySkuAsc.inventory.map((item) => item.public_id)).toEqual([a.public_id, b.public_id]);

      const byQuantityDesc = await listInventory(1, 20, undefined, undefined, false, "-quantity_on_hand");
      expect(byQuantityDesc.inventory.map((item) => item.public_id)).toEqual([b.public_id, a.public_id]);

      const byAvailableDesc = await listInventory(1, 20, undefined, undefined, false, "-quantity_available");
      expect(byAvailableDesc.inventory.map((item) => item.public_id)).toEqual([b.public_id, a.public_id]);
    });

    it("reports pagination metadata", async () => {
      const product = await createProduct();
      for (let index = 0; index < 3; index += 1) {
        const variant = await createVariant(product.id);
        await createInventory(variant.id);
      }

      const result = await listInventory(2, 2, undefined, undefined, false, "product_name");

      expect(result.inventory).toHaveLength(1);
      expect(result.pagination).toEqual({
        page: 2,
        limit: 2,
        total: 3,
        totalPages: 2,
        hasNext: false,
        hasPrev: true,
      });
    });
  });

  describe("getInventory", () => {
    it("returns the inventory object with derived fields", async () => {
      const product = await createProduct({ name: "Wireless Headphones" });
      const variant = await createVariant(product.id, { sku: "WH-1000" });
      await createInventory(variant.id, { quantity_on_hand: 100, quantity_reserved: 5, reorder_level: 20 });

      const result = await getInventory(variant.public_id);

      expect(result.public_id).toBe(variant.public_id);
      expect(result.quantity_on_hand).toBe(100);
      expect(result.quantity_reserved).toBe(5);
      expect(result.quantity_available).toBe(95);
      expect(result.stock_status).toBe("IN_STOCK");
      expect(result).not.toHaveProperty("id");
      expect(result).not.toHaveProperty("deleted_at");
    });

    it("throws NotFoundError for a variant without an inventory record", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);

      await expect(getInventory(variant.public_id)).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for an unknown variant", async () => {
      await expect(getInventory("var_unknown")).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for a soft-deleted variant", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id, { deleted_at: new Date() });
      await createInventory(variant.id);

      await expect(getInventory(variant.public_id)).rejects.toThrow(NotFoundError);
    });
  });

  describe("createInventory", () => {
    it("creates an inventory record with derived fields", async () => {
      const product = await createProduct({ name: "Wireless Headphones" });
      const variant = await createVariant(product.id, { sku: "WH-1000" });

      const result = await createInventoryService({
        variant_public_id: variant.public_id,
        quantity_on_hand: 100,
        reorder_level: 20,
      });

      expect(result.public_id).toBe(variant.public_id);
      expect(result.product_name).toBe("Wireless Headphones");
      expect(result.quantity_on_hand).toBe(100);
      expect(result.quantity_reserved).toBe(0);
      expect(result.quantity_available).toBe(100);
      expect(result.reorder_level).toBe(20);
      expect(result.stock_status).toBe("IN_STOCK");
      expect(result.last_stock_update.getTime()).toBe(result.created_at.getTime());

      const stored = await prisma.inventory.findFirst({
        where: { product_variants_id: variant.id },
      });
      expect(stored).not.toBeNull();
    });

    it("defaults reorder_level to null when omitted", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);

      const result = await createInventoryService({
        variant_public_id: variant.public_id,
        quantity_on_hand: 10,
      });

      expect(result.reorder_level).toBeNull();
      expect(result.stock_status).toBe("IN_STOCK");
    });

    it("throws NotFoundError for an unknown variant", async () => {
      await expect(
        createInventoryService({ variant_public_id: "var_unknown", quantity_on_hand: 10 }),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for a soft-deleted variant", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id, { deleted_at: new Date() });

      await expect(
        createInventoryService({ variant_public_id: variant.public_id, quantity_on_hand: 10 }),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws ConflictError when an inventory record already exists", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);
      await createInventory(variant.id);

      await expect(
        createInventoryService({ variant_public_id: variant.public_id, quantity_on_hand: 10 }),
      ).rejects.toThrow(ConflictError);
    });
  });

  describe("updateInventory", () => {
    it("sets an absolute quantity_on_hand", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);
      await createInventory(variant.id, { quantity_on_hand: 100 });

      const result = await updateInventoryService(
        variant.public_id,
        { quantity_on_hand: 75 },
        actor,
      );

      expect(result.quantity_on_hand).toBe(75);
      expect(result.quantity_available).toBe(75);
    });

    it("applies a positive quantity_change as an increment", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);
      await createInventory(variant.id, { quantity_on_hand: 10 });

      const result = await updateInventoryService(
        variant.public_id,
        { quantity_change: 25 },
        actor,
      );

      expect(result.quantity_on_hand).toBe(35);
    });

    it("applies a negative quantity_change and persists it", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);
      await createInventory(variant.id, { quantity_on_hand: 100 });

      const result = await updateInventoryService(
        variant.public_id,
        { quantity_change: -15, reason: "Damaged units written off" },
        actor,
      );

      expect(result.quantity_on_hand).toBe(85);

      const stored = await prisma.inventory.findFirst({
        where: { product_variants_id: variant.id },
      });
      expect(stored!.quantity_on_hand).toBe(85);
    });

    it("throws ConflictError when a delta would drive stock below zero", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);
      await createInventory(variant.id, { quantity_on_hand: 10 });

      await expect(
        updateInventoryService(variant.public_id, { quantity_change: -15 }, actor),
      ).rejects.toThrow(ConflictError);
    });

    it("does not persist a rejected delta", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);
      await createInventory(variant.id, { quantity_on_hand: 10 });

      await expect(
        updateInventoryService(variant.public_id, { quantity_change: -15 }, actor),
      ).rejects.toThrow(ConflictError);

      const stored = await prisma.inventory.findFirst({
        where: { product_variants_id: variant.id },
      });
      expect(stored!.quantity_on_hand).toBe(10);
    });

    it("allows setting the absolute quantity to zero", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);
      await createInventory(variant.id, { quantity_on_hand: 10 });

      const result = await updateInventoryService(
        variant.public_id,
        { quantity_on_hand: 0 },
        actor,
      );

      expect(result.quantity_on_hand).toBe(0);
      expect(result.stock_status).toBe("OUT_OF_STOCK");
    });

    it("updates reorder_level and clears it with null", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);
      await createInventory(variant.id, { quantity_on_hand: 3, reorder_level: 20 });

      const updated = await updateInventoryService(
        variant.public_id,
        { reorder_level: 5 },
        actor,
      );
      expect(updated.reorder_level).toBe(5);
      expect(updated.stock_status).toBe("LOW_STOCK");

      const cleared = await updateInventoryService(
        variant.public_id,
        { reorder_level: null },
        actor,
      );
      expect(cleared.reorder_level).toBeNull();
      expect(cleared.stock_status).toBe("IN_STOCK");
    });

    it("refreshes last_stock_update on every write", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);
      const previousUpdate = new Date(Date.now() - 60 * 60 * 1000);
      await createInventory(variant.id, { last_stock_update: previousUpdate });

      const result = await updateInventoryService(
        variant.public_id,
        { quantity_change: 5 },
        actor,
      );

      expect(result.last_stock_update.getTime()).toBeGreaterThan(previousUpdate.getTime());
    });

    it("throws NotFoundError for a variant without an inventory record", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id);

      await expect(
        updateInventoryService(variant.public_id, { quantity_change: 5 }, actor),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for a soft-deleted variant", async () => {
      const product = await createProduct();
      const variant = await createVariant(product.id, { deleted_at: new Date() });
      await createInventory(variant.id);

      await expect(
        updateInventoryService(variant.public_id, { quantity_change: 5 }, actor),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
