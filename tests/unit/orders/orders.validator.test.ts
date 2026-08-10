import { describe, it, expect } from "vitest";
import {
  listOrdersSchema,
  orderParamsSchema,
  placeOrderSchema,
} from "../../../src/modules/orders/validators/orders.js";
import {
  adminOrderParamsSchema,
  listAdminOrdersSchema,
  updateOrderStatusSchema,
} from "../../../src/modules/orders/validators/admin.js";

describe("placeOrderSchema", () => {
  const validBody = {
    address_public_id: "adr_abc",
    payment_method: "mock",
  };

  it("accepts a valid payload", () => {
    const result = placeOrderSchema.safeParse({ body: validBody });
    expect(result.success).toBe(true);
  });

  it("accepts optional coupon_code and notes", () => {
    const result = placeOrderSchema.safeParse({
      body: { ...validBody, coupon_code: "SUMMER10", notes: "Leave at door" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing address_public_id", () => {
    const result = placeOrderSchema.safeParse({
      body: { payment_method: "mock" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty address_public_id", () => {
    const result = placeOrderSchema.safeParse({
      body: { address_public_id: "", payment_method: "mock" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unsupported payment_method", () => {
    const result = placeOrderSchema.safeParse({
      body: { address_public_id: "adr_abc", payment_method: "stripe" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a coupon_code longer than 50 characters", () => {
    const result = placeOrderSchema.safeParse({
      body: { ...validBody, coupon_code: "C".repeat(51) },
    });
    expect(result.success).toBe(false);
  });

  it("rejects notes longer than 1000 characters", () => {
    const result = placeOrderSchema.safeParse({
      body: { ...validBody, notes: "N".repeat(1001) },
    });
    expect(result.success).toBe(false);
  });
});

describe("listOrdersSchema", () => {
  it("defaults sort to -placed_at and pagination to page 1 limit 20", () => {
    const result = listOrdersSchema.safeParse({ query: {} });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.sort).toBe("-placed_at");
      expect(result.data.query.page).toBe(1);
      expect(result.data.query.limit).toBe(20);
    }
  });

  it("accepts all supported sort fields", () => {
    for (const sort of [
      "placed_at",
      "order_number",
      "total_amount",
      "-placed_at",
      "-order_number",
      "-total_amount",
    ]) {
      const result = listOrdersSchema.safeParse({ query: { sort } });
      expect(result.success).toBe(true);
    }
  });

  it("rejects an unsupported sort field", () => {
    const result = listOrdersSchema.safeParse({
      query: { sort: "customer_name" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid order status", () => {
    const result = listOrdersSchema.safeParse({
      query: { status: "confirmed" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid order status", () => {
    const result = listOrdersSchema.safeParse({ query: { status: "paid" } });
    expect(result.success).toBe(false);
  });

  it("coerces page and limit to numbers", () => {
    const result = listOrdersSchema.safeParse({
      query: { page: "2", limit: "50" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.page).toBe(2);
      expect(result.data.query.limit).toBe(50);
    }
  });

  it("rejects a limit above the maximum", () => {
    const result = listOrdersSchema.safeParse({ query: { limit: 101 } });
    expect(result.success).toBe(false);
  });
});

describe("orderParamsSchema", () => {
  it("accepts a valid order_public_id", () => {
    const result = orderParamsSchema.safeParse({
      params: { order_public_id: "ord_abc" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing order_public_id", () => {
    const result = orderParamsSchema.safeParse({ params: {} });
    expect(result.success).toBe(false);
  });
});

describe("listAdminOrdersSchema", () => {
  it("defaults sort to -placed_at", () => {
    const result = listAdminOrdersSchema.safeParse({ query: {} });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.sort).toBe("-placed_at");
    }
  });

  it("accepts the customer_name sort field", () => {
    const result = listAdminOrdersSchema.safeParse({
      query: { sort: "customer_name" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unsupported sort field", () => {
    const result = listAdminOrdersSchema.safeParse({
      query: { sort: "customer_email" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts a search term", () => {
    const result = listAdminOrdersSchema.safeParse({
      query: { search: "Ahmed" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts placed_from and placed_to when placed_from <= placed_to", () => {
    const result = listAdminOrdersSchema.safeParse({
      query: {
        placed_from: "2025-01-01T00:00:00.000Z",
        placed_to: "2025-01-31T00:00:00.000Z",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects placed_from after placed_to", () => {
    const result = listAdminOrdersSchema.safeParse({
      query: {
        placed_from: "2025-02-01T00:00:00.000Z",
        placed_to: "2025-01-01T00:00:00.000Z",
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-datetime placed_from", () => {
    const result = listAdminOrdersSchema.safeParse({
      query: { placed_from: "not-a-date" },
    });
    expect(result.success).toBe(false);
  });
});

describe("adminOrderParamsSchema", () => {
  it("accepts a valid order_public_id", () => {
    const result = adminOrderParamsSchema.safeParse({
      params: { order_public_id: "ord_abc" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing order_public_id", () => {
    const result = adminOrderParamsSchema.safeParse({ params: {} });
    expect(result.success).toBe(false);
  });
});

describe("updateOrderStatusSchema", () => {
  it("accepts a valid status transition body", () => {
    const result = updateOrderStatusSchema.safeParse({
      params: { order_public_id: "ord_abc" },
      body: { status: "processing" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid status", () => {
    const result = updateOrderStatusSchema.safeParse({
      params: { order_public_id: "ord_abc" },
      body: { status: "paid" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing status", () => {
    const result = updateOrderStatusSchema.safeParse({
      params: { order_public_id: "ord_abc" },
      body: {},
    });
    expect(result.success).toBe(false);
  });

  it("requires carrier when transitioning to shipped", () => {
    const result = updateOrderStatusSchema.safeParse({
      params: { order_public_id: "ord_abc" },
      body: { status: "shipped" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts carrier and tracking_number when shipping", () => {
    const result = updateOrderStatusSchema.safeParse({
      params: { order_public_id: "ord_abc" },
      body: { status: "shipped", carrier: "DHL", tracking_number: "TRK-123" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a carrier longer than 100 characters", () => {
    const result = updateOrderStatusSchema.safeParse({
      params: { order_public_id: "ord_abc" },
      body: { status: "shipped", carrier: "C".repeat(101) },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a tracking_number longer than 100 characters", () => {
    const result = updateOrderStatusSchema.safeParse({
      params: { order_public_id: "ord_abc" },
      body: {
        status: "shipped",
        carrier: "DHL",
        tracking_number: "T".repeat(101),
      },
    });
    expect(result.success).toBe(false);
  });

  it("allows carrier to be omitted for non-shipped transitions", () => {
    const result = updateOrderStatusSchema.safeParse({
      params: { order_public_id: "ord_abc" },
      body: { status: "delivered" },
    });
    expect(result.success).toBe(true);
  });
});
