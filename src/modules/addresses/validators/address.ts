import { z } from "zod";

const recipientName = z.string().trim().min(1).max(100);
const phoneNumber = z.string().trim().min(1).max(20);
const label = z.string().trim().max(50);
const country = z.string().trim().min(1).max(100);
const state = z.string().trim().min(1).max(100);
const city = z.string().trim().min(1).max(100);
const address1 = z.string().trim().min(1).max(255);
const address2 = z.string().trim().max(255);
const zipCode = z.string().trim().max(20);
const isDefaultShipping = z.boolean();
const isDefaultBilling = z.boolean();

export const createAddressSchema = z.object({
  body: z.object({
    recipient_name: recipientName,
    phone_number: phoneNumber,
    label: label.nullish(),
    country,
    state,
    city,
    address_1: address1,
    address_2: address2.nullish(),
    zip_code: zipCode.nullish(),
    is_default_shipping: isDefaultShipping.optional(),
    is_default_billing: isDefaultBilling.optional(),
  }),
});

export type CreateAddressBody = z.infer<typeof createAddressSchema.shape.body>;

export const updateAddressSchema = z.object({
  params: z.object({
    address_public_id: z.string().min(1),
  }),
  body: z.object({
    recipient_name: recipientName.optional(),
    phone_number: phoneNumber.optional(),
    label: label.nullish(),
    country: country.optional(),
    state: state.optional(),
    city: city.optional(),
    address_1: address1.optional(),
    address_2: address2.nullish(),
    zip_code: zipCode.nullish(),
    is_default_shipping: isDefaultShipping.optional(),
    is_default_billing: isDefaultBilling.optional(),
  }),
});

export type UpdateAddressBody = z.infer<typeof updateAddressSchema.shape.body>;

export const addressParamsSchema = z.object({
  params: z.object({
    address_public_id: z.string().min(1),
  }),
});

export type AddressParams = z.infer<typeof addressParamsSchema.shape.params>;

export const listAddressesSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export type ListAddressesQuery = z.infer<typeof listAddressesSchema.shape.query>;
