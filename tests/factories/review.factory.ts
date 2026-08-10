import { nanoid } from "nanoid";
import { prisma } from "../../src/config/database.js";
import { generatePublicId } from "../../src/shared/utils/index.js";
import { PUBLIC_ID_PREFIXES } from "../../src/shared/constants/index.js";

export interface CreateReviewOverrides {
  users_id: number;
  products_id: number;
  rating?: number;
  title?: string | null;
  comment?: string | null;
  is_approved?: boolean;
  deleted_at?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

export async function createReview(overrides: CreateReviewOverrides) {
  const now = new Date();

  return prisma.reviews.create({
    data: {
      public_id: generatePublicId(PUBLIC_ID_PREFIXES.REVIEW),
      users_id: overrides.users_id,
      products_id: overrides.products_id,
      rating: overrides.rating ?? 5,
      title: overrides.title ?? null,
      comment: overrides.comment ?? `A test review ${nanoid(6)}`,
      is_approved: overrides.is_approved ?? true,
      deleted_at: overrides.deleted_at ?? null,
      created_at: overrides.created_at ?? now,
      updated_at: overrides.updated_at ?? now,
    },
  });
}

export interface CreateReviewImageOverrides {
  reviews_id: number;
  image_url?: string;
  alt_text?: string | null;
  display_order?: number | null;
}

export async function createReviewImage(
  overrides: CreateReviewImageOverrides,
) {
  const now = new Date();

  return prisma.review_images.create({
    data: {
      public_id: generatePublicId(PUBLIC_ID_PREFIXES.REVIEW_IMAGE),
      reviews_id: overrides.reviews_id,
      image_url:
        overrides.image_url ?? `https://example.com/reviews/${nanoid(6)}.jpg`,
      alt_text: overrides.alt_text ?? null,
      display_order: overrides.display_order ?? null,
      created_at: now,
      updated_at: now,
    },
  });
}
