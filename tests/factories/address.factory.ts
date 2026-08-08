import { prisma } from "../../src/config/database.js";
import { generatePublicId } from "../../src/shared/utils/index.js";
import { PUBLIC_ID_PREFIXES } from "../../src/shared/constants/index.js";

export interface CreateAddressOverrides {
  recipient_name?: string;
  phone_number?: string;
  label?: string | null;
  country?: string;
  state?: string;
  city?: string;
  address_1?: string;
  address_2?: string | null;
  zip_code?: string | null;
  is_default_shipping?: boolean;
  is_default_billing?: boolean;
  deleted_at?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

export async function createAddress(
  usersId: number,
  overrides: CreateAddressOverrides = {},
) {
  const now = new Date();

  return prisma.user_addresses.create({
    data: {
      public_id: generatePublicId(PUBLIC_ID_PREFIXES.ADDRESS),
      recipient_name: overrides.recipient_name ?? "Test Recipient",
      phone_number: overrides.phone_number ?? "+15550000000",
      label: overrides.label ?? null,
      country: overrides.country ?? "Egypt",
      state: overrides.state ?? "Cairo",
      city: overrides.city ?? "Cairo",
      address_1: overrides.address_1 ?? "12 Test Street",
      address_2: overrides.address_2 ?? null,
      zip_code: overrides.zip_code ?? null,
      users_id: usersId,
      is_default_shipping: overrides.is_default_shipping ?? true,
      is_default_billing: overrides.is_default_billing ?? true,
      deleted_at: overrides.deleted_at ?? null,
      created_at: overrides.created_at ?? now,
      updated_at: overrides.updated_at ?? now,
    },
  });
}
