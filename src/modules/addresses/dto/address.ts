import type { CreateAddressBody, UpdateAddressBody } from "../validators/address.js";

export type CreateAddressInput = CreateAddressBody;
export type UpdateAddressInput = UpdateAddressBody;

export interface AddressResult {
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
  is_default_shipping: boolean;
  is_default_billing: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ListAddressesResult {
  addresses: AddressResult[];
  pagination: PaginationMeta;
}
