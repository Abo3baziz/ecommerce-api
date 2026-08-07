import { prisma } from "../../../config/database.js";
import type { Prisma } from "../../../generated/prisma/client.js";

type DbClient = Prisma.TransactionClient | typeof prisma;

export interface CreateAddressData {
  public_id: string;
  recipient_name: string;
  phone_number: string;
  label: string | null;
  country: string;
  state: string;
  city: string;
  address_1: string;
  address_2: string | null;
  zip_code: string | null;
  users_id: number;
  is_default_shipping: boolean;
  is_default_billing: boolean;
}

export interface UpdateAddressData {
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
}

const addressSelect = {
  id: true,
  public_id: true,
  recipient_name: true,
  phone_number: true,
  label: true,
  country: true,
  state: true,
  city: true,
  address_1: true,
  address_2: true,
  zip_code: true,
  is_default_shipping: true,
  is_default_billing: true,
  created_at: true,
  updated_at: true,
} as const;

export type AddressRow = Prisma.user_addressesGetPayload<{
  select: typeof addressSelect;
}>;

export const addressRepository = {
  createAddress(data: CreateAddressData, client: DbClient = prisma) {
    const now = new Date();
    return client.user_addresses.create({
      data: {
        ...data,
        created_at: now,
        updated_at: now,
      },
      select: addressSelect,
    });
  },

  findOwnedByPublicId(public_id: string, users_id: number) {
    return prisma.user_addresses.findFirst({
      where: {
        public_id,
        users_id,
        deleted_at: null,
      },
      select: addressSelect,
    });
  },

  findOwnedIdByPublicId(public_id: string, users_id: number) {
    return prisma.user_addresses.findFirst({
      where: {
        public_id,
        users_id,
        deleted_at: null,
      },
      select: { id: true },
    });
  },

  countByUser(users_id: number) {
    return prisma.user_addresses.count({
      where: {
        users_id,
        deleted_at: null,
      },
    });
  },

  listByUser(users_id: number, skip: number, take: number) {
    return prisma.user_addresses.findMany({
      where: {
        users_id,
        deleted_at: null,
      },
      orderBy: { created_at: "desc" },
      skip,
      take,
      select: addressSelect,
    });
  },

  updateAddress(id: number, data: UpdateAddressData, client: DbClient = prisma) {
    return client.user_addresses.update({
      where: { id },
      data: {
        ...data,
        updated_at: new Date(),
      },
      select: addressSelect,
    });
  },

  clearDefaultShipping(users_id: number, exceptId: number, client: DbClient = prisma) {
    return client.user_addresses.updateMany({
      where: {
        users_id,
        id: { not: exceptId },
        is_default_shipping: true,
        deleted_at: null,
      },
      data: {
        is_default_shipping: false,
        updated_at: new Date(),
      },
    });
  },

  clearDefaultBilling(users_id: number, exceptId: number, client: DbClient = prisma) {
    return client.user_addresses.updateMany({
      where: {
        users_id,
        id: { not: exceptId },
        is_default_billing: true,
        deleted_at: null,
      },
      data: {
        is_default_billing: false,
        updated_at: new Date(),
      },
    });
  },

  softDelete(id: number, client: DbClient = prisma) {
    return client.user_addresses.update({
      where: { id },
      data: {
        deleted_at: new Date(),
        updated_at: new Date(),
      },
    });
  },
};
