import { nanoid } from "nanoid";
import { prisma } from "../../src/config/database.js";
import { generatePublicId } from "../../src/shared/utils/index.js";
import { PUBLIC_ID_PREFIXES } from "../../src/shared/constants/index.js";

export interface CreateCategoryOverrides {
  name?: string;
  slug?: string;
  description?: string | null;
  is_active?: boolean;
  deleted_at?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

export async function createCategory(overrides: CreateCategoryOverrides = {}) {
  const now = new Date();

  return prisma.categories.create({
    data: {
      public_id: generatePublicId(PUBLIC_ID_PREFIXES.CATEGORY),
      name: overrides.name ?? `Test Category ${nanoid(6)}`,
      slug: overrides.slug ?? `test-category-${nanoid(6)}`,
      description: overrides.description ?? "A test category description.",
      is_active: overrides.is_active ?? true,
      deleted_at: overrides.deleted_at ?? null,
      created_at: overrides.created_at ?? now,
      updated_at: overrides.updated_at ?? now,
    },
  });
}
