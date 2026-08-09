import { hash } from "bcrypt";
import { nanoid } from "nanoid";
import { prisma } from "../../src/config/database.js";
import { generatePublicId } from "../../src/shared/utils/index.js";
import { PUBLIC_ID_PREFIXES } from "../../src/shared/constants/index.js";
import { user_role, user_status } from "../../src/generated/prisma/enums.js";
import { randomPhoneNumber } from "../helpers/random.js";

export const TEST_PASSWORD = "StrongPassword123!";

export interface CreateUserOverrides {
  email?: string;
  phone_number?: string;
  first_name?: string;
  last_name?: string;
  password?: string;
  email_verified_at?: Date | null;
  role?: user_role;
  status?: user_status;
  deleted_at?: Date | null;
}

export async function createUser(overrides: CreateUserOverrides = {}) {
  const now = new Date();

  return prisma.users.create({
    data: {
      public_id: generatePublicId(PUBLIC_ID_PREFIXES.USER),
      email: overrides.email ?? `test-${nanoid(8)}@example.com`,
      phone_number: overrides.phone_number ?? randomPhoneNumber(),
      first_name: overrides.first_name ?? "Test",
      last_name: overrides.last_name ?? "User",
      password_hash: await hash(overrides.password ?? TEST_PASSWORD, 12),
      role: overrides.role ?? user_role.CUSTOMER,
      status: overrides.status ?? user_status.ACTIVE,
      email_verified_at: overrides.email_verified_at ?? null,
      deleted_at: overrides.deleted_at ?? null,
      created_at: now,
      updated_at: now,
    },
  });
}
