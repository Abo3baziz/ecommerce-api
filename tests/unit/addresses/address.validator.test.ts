import { describe, it, expect } from "vitest";
import {
  createAddressSchema,
  updateAddressSchema,
  addressParamsSchema,
  listAddressesSchema,
} from "../../../src/modules/addresses/validators/address.js";

const validBody = {
  recipient_name: "Ahmed Aziz",
  phone_number: "+201234567890",
  country: "Egypt",
  state: "Cairo",
  city: "Cairo",
  address_1: "12 Tahrir Square",
};

describe("createAddressSchema", () => {
  it("accepts a valid payload", () => {
    const result = createAddressSchema.safeParse({ body: validBody });
    expect(result.success).toBe(true);
  });

  it("accepts optional fields", () => {
    const result = createAddressSchema.safeParse({
      body: {
        ...validBody,
        label: "Home",
        address_2: "Apartment 5",
        zip_code: "11511",
        is_default_shipping: true,
        is_default_billing: false,
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing required field", () => {
    const { country, ...body } = validBody;
    const result = createAddressSchema.safeParse({ body });
    expect(result.success).toBe(false);
  });

  it("rejects a blank recipient_name", () => {
    const result = createAddressSchema.safeParse({
      body: { ...validBody, recipient_name: "   " },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-boolean default flag", () => {
    const result = createAddressSchema.safeParse({
      body: { ...validBody, is_default_shipping: "yes" },
    });
    expect(result.success).toBe(false);
  });
});

describe("updateAddressSchema", () => {
  it("accepts a partial payload", () => {
    const result = updateAddressSchema.safeParse({
      params: { address_public_id: "adr_abc" },
      body: { label: "Work" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty body", () => {
    const result = updateAddressSchema.safeParse({
      params: { address_public_id: "adr_abc" },
      body: {},
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing address_public_id param", () => {
    const result = updateAddressSchema.safeParse({
      params: {},
      body: { label: "Work" },
    });
    expect(result.success).toBe(false);
  });
});

describe("addressParamsSchema", () => {
  it("accepts an address public id", () => {
    const result = addressParamsSchema.safeParse({
      params: { address_public_id: "adr_abc" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing address_public_id", () => {
    const result = addressParamsSchema.safeParse({ params: {} });
    expect(result.success).toBe(false);
  });
});

describe("listAddressesSchema", () => {
  it("applies defaults when no query is provided", () => {
    const result = listAddressesSchema.safeParse({ query: {} });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.page).toBe(1);
      expect(result.data.query.limit).toBe(20);
    }
  });

  it("coerces numeric query values", () => {
    const result = listAddressesSchema.safeParse({ query: { page: "2", limit: "10" } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.page).toBe(2);
      expect(result.data.query.limit).toBe(10);
    }
  });

  it("rejects a limit above 100", () => {
    const result = listAddressesSchema.safeParse({ query: { limit: "101" } });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer page", () => {
    const result = listAddressesSchema.safeParse({ query: { page: "1.5" } });
    expect(result.success).toBe(false);
  });
});
