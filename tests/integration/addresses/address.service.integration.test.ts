import { describe, it, expect, beforeEach } from "vitest";
import {
  createAddress as createAddressService,
  deleteAddress as deleteAddressService,
  getAddress,
  listAddresses,
  updateAddress as updateAddressService,
} from "../../../src/modules/addresses/service/address.service.js";
import { NotFoundError } from "../../../src/shared/errors/NotFoundError.js";
import { prisma } from "../../../src/config/database.js";
import { createAddress } from "../../factories/address.factory.js";
import { createUser } from "../../factories/user.factory.js";
import { cleanupTestData } from "../../helpers/db.js";
import { randomPhoneNumber } from "../../helpers/random.js";

function addressPayload(overrides: Record<string, unknown> = {}) {
  return {
    recipient_name: "Ahmed Aziz",
    phone_number: randomPhoneNumber(),
    label: "Home",
    country: "Egypt",
    state: "Cairo",
    city: "Cairo",
    address_1: "12 Test Street",
    address_2: null,
    zip_code: "11511",
    ...overrides,
  };
}

describe("address.service", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("createAddress", () => {
    it("makes the first address the default for both shipping and billing when flags are omitted", async () => {
      const user = await createUser();

      const result = await createAddressService(user.id, addressPayload());

      expect(result.public_id).toMatch(/^adr_/);
      expect(result.is_default_shipping).toBe(true);
      expect(result.is_default_billing).toBe(true);
    });

    it("does not default a later address when flags are omitted", async () => {
      const user = await createUser();
      await createAddressService(user.id, addressPayload());

      const second = await createAddressService(user.id, addressPayload());

      expect(second.is_default_shipping).toBe(false);
      expect(second.is_default_billing).toBe(false);
    });

    it("clears other shipping defaults when is_default_shipping is true", async () => {
      const user = await createUser();
      const first = await createAddressService(user.id, addressPayload());

      const second = await createAddressService(user.id, addressPayload({
        is_default_shipping: true,
      }));

      expect(second.is_default_shipping).toBe(true);

      const firstStored = await prisma.user_addresses.findFirst({
        where: { public_id: first.public_id },
      });
      expect(firstStored!.is_default_shipping).toBe(false);
      expect(firstStored!.is_default_billing).toBe(true);
    });

    it("clears other billing defaults when is_default_billing is true", async () => {
      const user = await createUser();
      const first = await createAddressService(user.id, addressPayload());

      const second = await createAddressService(user.id, addressPayload({
        is_default_billing: true,
      }));

      expect(second.is_default_billing).toBe(true);

      const firstStored = await prisma.user_addresses.findFirst({
        where: { public_id: first.public_id },
      });
      expect(firstStored!.is_default_billing).toBe(false);
      expect(firstStored!.is_default_shipping).toBe(true);
    });
  });

  describe("listAddresses", () => {
    it("returns addresses ordered by newest first", async () => {
      const user = await createUser();
      const older = await createAddress(user.id, {
        ...addressPayload(),
        created_at: new Date(2020, 0, 1),
      });
      const newer = await createAddress(user.id, {
        ...addressPayload(),
        created_at: new Date(2021, 0, 1),
      });

      const result = await listAddresses(user.id, 1, 10);

      expect(result.addresses.map((address) => address.public_id)).toEqual([
        newer.public_id,
        older.public_id,
      ]);
    });

    it("paginates correctly and reports metadata", async () => {
      const user = await createUser();
      for (let index = 0; index < 5; index += 1) {
        await createAddressService(user.id, addressPayload());
      }

      const result = await listAddresses(user.id, 2, 2);

      expect(result.addresses).toHaveLength(2);
      expect(result.pagination).toEqual({
        page: 2,
        limit: 2,
        total: 5,
        totalPages: 3,
        hasNext: true,
        hasPrev: true,
      });
    });

    it("excludes soft-deleted addresses", async () => {
      const user = await createUser();
      await createAddress(user.id, {
        ...addressPayload(),
        deleted_at: new Date(),
      });
      await createAddressService(user.id, addressPayload());

      const result = await listAddresses(user.id, 1, 10);

      expect(result.addresses).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });
  });

  describe("getAddress", () => {
    it("returns an address owned by the user", async () => {
      const user = await createUser();
      const address = await createAddress(user.id, addressPayload());

      const result = await getAddress(user.id, address.public_id);

      expect(result.public_id).toBe(address.public_id);
      expect(result.recipient_name).toBe(address.recipient_name);
    });

    it("throws NotFoundError for an address owned by another user", async () => {
      const owner = await createUser();
      const other = await createUser();
      const address = await createAddress(owner.id, addressPayload());

      await expect(getAddress(other.id, address.public_id)).rejects.toThrow(
        NotFoundError,
      );
    });

    it("throws NotFoundError for a soft-deleted address", async () => {
      const user = await createUser();
      const address = await createAddress(user.id, {
        ...addressPayload(),
        deleted_at: new Date(),
      });

      await expect(getAddress(user.id, address.public_id)).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("updateAddress", () => {
    it("updates fields and preserves existing default flags", async () => {
      const user = await createUser();
      const address = await createAddress(user.id, addressPayload());

      const updated = await updateAddressService(user.id, address.public_id, {
        recipient_name: "Omar Hassan",
        city: "Giza",
      });

      expect(updated.recipient_name).toBe("Omar Hassan");
      expect(updated.city).toBe("Giza");
      expect(updated.is_default_shipping).toBe(true);
      expect(updated.is_default_billing).toBe(true);
    });

    it("clears other shipping defaults when promoted to default", async () => {
      const user = await createUser();
      const first = await createAddressService(user.id, addressPayload());
      const second = await createAddressService(user.id, addressPayload());

      const updated = await updateAddressService(user.id, second.public_id, {
        is_default_shipping: true,
      });

      expect(updated.is_default_shipping).toBe(true);

      const firstStored = await prisma.user_addresses.findFirst({
        where: { public_id: first.public_id },
      });
      expect(firstStored!.is_default_shipping).toBe(false);
    });

    it("throws NotFoundError for an address owned by another user", async () => {
      const owner = await createUser();
      const other = await createUser();
      const address = await createAddress(owner.id, addressPayload());

      await expect(
        updateAddressService(other.id, address.public_id, { city: "Giza" }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("deleteAddress", () => {
    it("soft-deletes the address and removes it from listings", async () => {
      const user = await createUser();
      const address = await createAddressService(user.id, addressPayload());

      await deleteAddressService(user.id, address.public_id);

      const stored = await prisma.user_addresses.findFirst({
        where: { public_id: address.public_id },
      });
      expect(stored!.deleted_at).not.toBeNull();

      const result = await listAddresses(user.id, 1, 10);
      expect(result.addresses).toHaveLength(0);
      expect(result.pagination.total).toBe(0);
    });

    it("throws NotFoundError for an address owned by another user", async () => {
      const owner = await createUser();
      const other = await createUser();
      const address = await createAddress(owner.id, addressPayload());

      await expect(
        deleteAddressService(other.id, address.public_id),
      ).rejects.toThrow(NotFoundError);
    });
  });
});
