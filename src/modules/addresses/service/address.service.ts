import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { PUBLIC_ID_PREFIXES } from "../../../shared/constants/index.js";
import { generatePublicId, formatPaginationMeta } from "../../../shared/utils/index.js";
import { prisma } from "../../../config/database.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { addressRepository } from "../repository/address.repository.js";
import type { AddressRow } from "../repository/address.repository.js";
import type {
  AddressResult,
  CreateAddressInput,
  UpdateAddressInput,
  ListAddressesResult,
} from "../dto/address.js";

type DefaultFlag = "shipping" | "billing";

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/**
 * Guarantees the at-least-one side of the default-address invariant (T-042):
 * when no live row carries the flag, the oldest surviving address is
 * promoted. Must run inside the caller's transaction.
 */
async function ensureDefaultPresent(
  tx: Prisma.TransactionClient,
  users_id: number,
  flag: DefaultFlag,
  excludeId?: number,
): Promise<void> {
  const hasDefault = await addressRepository.hasDefault(users_id, flag, tx);
  if (hasDefault) {
    return;
  }

  const oldest = await addressRepository.findOldestLive(users_id, tx, excludeId);
  if (!oldest || oldest.id === excludeId) {
    // No eligible survivor: either the user has no live addresses left, or
    // the only one is the row being edited/deleted (handled by the caller).
    return;
  }

  await addressRepository.updateAddress(
    oldest.id,
    flag === "shipping"
      ? { is_default_shipping: true }
      : { is_default_billing: true },
    tx,
  );
}

function toAddressResult(row: AddressRow): AddressResult {
  return {
    public_id: row.public_id,
    recipient_name: row.recipient_name,
    phone_number: row.phone_number,
    label: row.label,
    country: row.country,
    state: row.state,
    city: row.city,
    address_1: row.address_1,
    address_2: row.address_2,
    zip_code: row.zip_code,
    is_default_shipping: row.is_default_shipping,
    is_default_billing: row.is_default_billing,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function listAddresses(
  users_id: number,
  page: number,
  limit: number,
): Promise<ListAddressesResult> {
  const [rows, total] = await Promise.all([
    addressRepository.listByUser(users_id, (page - 1) * limit, limit),
    addressRepository.countByUser(users_id),
  ]);

  return {
    addresses: rows.map(toAddressResult),
    pagination: formatPaginationMeta(page, limit, total),
  };
}

export async function getAddress(
  users_id: number,
  addressPublicId: string,
): Promise<AddressResult> {
  const row = await addressRepository.findOwnedByPublicId(addressPublicId, users_id);

  if (!row) {
    throw new NotFoundError("Address not found");
  }

  return toAddressResult(row);
}

export async function createAddress(
  users_id: number,
  input: CreateAddressInput,
): Promise<AddressResult> {
  const created = await prisma
    .$transaction(async (tx) => {
      // Decide default flags inside the transaction; concurrent first
      // creates are arbitrated by the partial unique indexes (T-042).
      const existingCount = await addressRepository.countByUser(users_id, tx);
      const isDefaultShipping = input.is_default_shipping ?? existingCount === 0;
      const isDefaultBilling = input.is_default_billing ?? existingCount === 0;

      if (isDefaultShipping) {
        await addressRepository.clearDefaultShipping(users_id, -1, tx);
      }
      if (isDefaultBilling) {
        await addressRepository.clearDefaultBilling(users_id, -1, tx);
      }

      return addressRepository.createAddress(
        {
          public_id: generatePublicId(PUBLIC_ID_PREFIXES.ADDRESS),
          recipient_name: input.recipient_name,
          phone_number: input.phone_number,
          label: input.label ?? null,
          country: input.country,
          state: input.state,
          city: input.city,
          address_1: input.address_1,
          address_2: input.address_2 ?? null,
          zip_code: input.zip_code ?? null,
          users_id,
          is_default_shipping: isDefaultShipping,
          is_default_billing: isDefaultBilling,
        },
        tx,
      );
    })
    .catch((error: unknown) => {
      if (isUniqueViolation(error)) {
        throw new ConflictError(
          "You already have a default address of this type",
        );
      }
      throw error;
    });

  return toAddressResult(created);
}

export async function updateAddress(
  users_id: number,
  addressPublicId: string,
  input: UpdateAddressInput,
): Promise<AddressResult> {
  const owned = await addressRepository.findOwnedByPublicId(
    addressPublicId,
    users_id,
  );

  if (!owned) {
    throw new NotFoundError("Address not found");
  }

  const updated = await prisma
    .$transaction(async (tx) => {
      // Clear other rows BEFORE setting this one so the single-default
      // indexes never observe two defaults mid-transaction.
      if (input.is_default_shipping === true) {
        await addressRepository.clearDefaultShipping(users_id, owned.id, tx);
      }
      if (input.is_default_billing === true) {
        await addressRepository.clearDefaultBilling(users_id, owned.id, tx);
      }

      const address = await addressRepository.updateAddress(
        owned.id,
        {
          recipient_name: input.recipient_name,
          phone_number: input.phone_number,
          label: input.label,
          country: input.country,
          state: input.state,
          city: input.city,
          address_1: input.address_1,
          address_2: input.address_2,
          zip_code: input.zip_code,
          is_default_shipping: input.is_default_shipping,
          is_default_billing: input.is_default_billing,
        },
        tx,
      );

      // Unsetting a flag must not leave the user without a default of that
      // type: promote the oldest surviving OTHER address (T-042 product
      // decision). The edited address itself is excluded from promotion so
      // an explicit unset is honoured whenever another address exists.
      if (owned.is_default_shipping && input.is_default_shipping === false) {
        await ensureDefaultPresent(tx, users_id, "shipping", owned.id);
      }
      if (owned.is_default_billing && input.is_default_billing === false) {
        await ensureDefaultPresent(tx, users_id, "billing", owned.id);
      }

      return address;
    })
    .catch((error: unknown) => {
      if (isUniqueViolation(error)) {
        throw new ConflictError(
          "You already have a default address of this type",
        );
      }
      throw error;
    });

  return toAddressResult(updated);
}

export async function deleteAddress(
  users_id: number,
  addressPublicId: string,
): Promise<void> {
  const owned = await addressRepository.findOwnedByPublicId(
    addressPublicId,
    users_id,
  );

  if (!owned) {
    throw new NotFoundError("Address not found");
  }

  await prisma.$transaction(async (tx) => {
    await addressRepository.softDelete(owned.id, tx);

    // Deleting a default must promote a successor so the user keeps exactly
    // one default per type while any live addresses remain (T-042).
    if (owned.is_default_shipping) {
      await ensureDefaultPresent(tx, users_id, "shipping");
    }
    if (owned.is_default_billing) {
      await ensureDefaultPresent(tx, users_id, "billing");
    }
  });
}
