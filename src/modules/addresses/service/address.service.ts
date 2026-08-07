import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import { PUBLIC_ID_PREFIXES } from "../../../shared/constants/index.js";
import { generatePublicId, formatPaginationMeta } from "../../../shared/utils/index.js";
import { prisma } from "../../../config/database.js";
import { addressRepository } from "../repository/address.repository.js";
import type { AddressRow } from "../repository/address.repository.js";
import type {
  AddressResult,
  CreateAddressInput,
  UpdateAddressInput,
  ListAddressesResult,
} from "../dto/address.js";

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
  const existingCount = await addressRepository.countByUser(users_id);
  const isDefaultShipping = input.is_default_shipping ?? existingCount === 0;
  const isDefaultBilling = input.is_default_billing ?? existingCount === 0;

  const created = await prisma.$transaction(async (tx) => {
    const address = await addressRepository.createAddress(
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

    if (isDefaultShipping) {
      await addressRepository.clearDefaultShipping(users_id, address.id, tx);
    }
    if (isDefaultBilling) {
      await addressRepository.clearDefaultBilling(users_id, address.id, tx);
    }

    return address;
  });

  return toAddressResult(created);
}

export async function updateAddress(
  users_id: number,
  addressPublicId: string,
  input: UpdateAddressInput,
): Promise<AddressResult> {
  const owned = await addressRepository.findOwnedIdByPublicId(
    addressPublicId,
    users_id,
  );

  if (!owned) {
    throw new NotFoundError("Address not found");
  }

  const shouldClearShipping = input.is_default_shipping === true;
  const shouldClearBilling = input.is_default_billing === true;

  const updated = await prisma.$transaction(async (tx) => {
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

    if (shouldClearShipping) {
      await addressRepository.clearDefaultShipping(users_id, owned.id, tx);
    }
    if (shouldClearBilling) {
      await addressRepository.clearDefaultBilling(users_id, owned.id, tx);
    }

    return address;
  });

  return toAddressResult(updated);
}

export async function deleteAddress(
  users_id: number,
  addressPublicId: string,
): Promise<void> {
  const owned = await addressRepository.findOwnedIdByPublicId(
    addressPublicId,
    users_id,
  );

  if (!owned) {
    throw new NotFoundError("Address not found");
  }

  await addressRepository.softDelete(owned.id);
}
