import { describe, it, expect } from "vitest";
import {
  adminUserParamsSchema,
  changeUserRoleSchema,
  listAdminUsersSchema,
  updateAdminUserSchema,
} from "../../../src/modules/users/validators/admin.js";

describe("listAdminUsersSchema", () => {
  it("applies default pagination and sort values", () => {
    const result = listAdminUsersSchema.safeParse({ query: {} });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.page).toBe(1);
      expect(result.data.query.limit).toBe(20);
      expect(result.data.query.include_deleted).toBe(false);
      expect(result.data.query.sort).toBe("-created_at");
    }
  });

  it("accepts a status filter", () => {
    const result = listAdminUsersSchema.safeParse({
      query: { status: "SUSPENDED" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid status", () => {
    const result = listAdminUsersSchema.safeParse({
      query: { status: "BANNED" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid sort field", () => {
    const result = listAdminUsersSchema.safeParse({
      query: { sort: "role" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a limit above the maximum", () => {
    const result = listAdminUsersSchema.safeParse({
      query: { limit: 101 },
    });
    expect(result.success).toBe(false);
  });
});

describe("adminUserParamsSchema", () => {
  it("accepts a valid public_id", () => {
    const result = adminUserParamsSchema.safeParse({
      params: { user_public_id: "usr_123" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty public_id", () => {
    const result = adminUserParamsSchema.safeParse({
      params: { user_public_id: "" },
    });
    expect(result.success).toBe(false);
  });
});

describe("updateAdminUserSchema", () => {
  it("accepts a partial payload", () => {
    const result = updateAdminUserSchema.safeParse({
      params: { user_public_id: "usr_123" },
      body: { first_name: "Ahmed" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = updateAdminUserSchema.safeParse({
      params: { user_public_id: "usr_123" },
      body: { email: "not-an-email" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid phone number", () => {
    const result = updateAdminUserSchema.safeParse({
      params: { user_public_id: "usr_123" },
      body: { phone_number: "0123456789" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a blank first_name", () => {
    const result = updateAdminUserSchema.safeParse({
      params: { user_public_id: "usr_123" },
      body: { first_name: "   " },
    });
    expect(result.success).toBe(false);
  });
});

describe("changeUserRoleSchema", () => {
  it("accepts an existing role", () => {
    const result = changeUserRoleSchema.safeParse({
      params: { user_public_id: "usr_123" },
      body: { role: "ADMIN" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts the customer role", () => {
    const result = changeUserRoleSchema.safeParse({
      params: { user_public_id: "usr_123" },
      body: { role: "CUSTOMER" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown role", () => {
    const result = changeUserRoleSchema.safeParse({
      params: { user_public_id: "usr_123" },
      body: { role: "SUPERADMIN" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects the SUPER_ADMIN role (CLI-only grant)", () => {
    const result = changeUserRoleSchema.safeParse({
      params: { user_public_id: "usr_123" },
      body: { role: "SUPER_ADMIN" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing role", () => {
    const result = changeUserRoleSchema.safeParse({
      params: { user_public_id: "usr_123" },
      body: {},
    });
    expect(result.success).toBe(false);
  });
});
