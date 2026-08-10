import { prisma } from "../../../config/database.js";
import {
  PUBLIC_ID_PREFIXES,
  REVIEWS_REQUIRE_PURCHASE,
} from "../../../shared/constants/index.js";
import { ConflictError } from "../../../shared/errors/ConflictError.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import { formatPaginationMeta, generatePublicId } from "../../../shared/utils/index.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import {
  newReviewImagePublicId,
  reviewRepository,
  type ReviewRow,
} from "../repository/review.repository.js";
import { parseSort } from "../utils/sort.js";
import type {
  CreateReviewBody,
  ListOwnReviewsResult,
  ListProductReviewsResult,
  OwnReviewResult,
  ReviewResult,
  UpdateReviewBody,
} from "../dto/review.js";

export function toReviewImageResults(row: ReviewRow) {
  return row.review_images.map((image) => ({
    public_id: image.public_id,
    image_url: image.image_url,
    alt_text: image.alt_text,
    display_order: image.display_order,
  }));
}

export function toReviewResult(row: ReviewRow): ReviewResult {
  return {
    public_id: row.public_id,
    rating: row.rating,
    title: row.title,
    comment: row.comment,
    customer_name: `${row.users.first_name} ${row.users.last_name}`,
    product_public_id: row.products.public_id,
    product_name: row.products.name,
    product_slug: row.products.slug,
    images: toReviewImageResults(row),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toOwnReviewResult(row: ReviewRow): OwnReviewResult {
  return {
    ...toReviewResult(row),
    is_approved: row.is_approved,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export async function listProductReviews(
  productPublicId: string,
  page: number,
  limit: number,
  rating: number | undefined,
  sort: string,
): Promise<ListProductReviewsResult> {
  const product = await reviewRepository.findProductIdByPublicId(productPublicId);

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  const { field, direction } = parseSort(sort);
  const orderBy: Prisma.reviewsOrderByWithRelationInput =
    field === "rating" ? { rating: direction } : { created_at: direction };
  const filters = { products_id: product.id, rating };

  const [rows, aggregate] = await Promise.all([
    reviewRepository.listProductReviews(
      filters,
      orderBy,
      direction,
      (page - 1) * limit,
      limit,
    ),
    reviewRepository.aggregateProductReviews(filters),
  ]);

  return {
    summary: {
      average_rating:
        aggregate.average === null ? null : round2(aggregate.average),
      total_count: aggregate.total,
    },
    reviews: rows.map(toReviewResult),
    pagination: formatPaginationMeta(page, limit, aggregate.total),
  };
}

export async function getReview(reviewPublicId: string): Promise<ReviewResult> {
  const row = await reviewRepository.findCustomerReviewByPublicId(reviewPublicId);

  if (!row) {
    throw new NotFoundError("Review not found");
  }

  return toReviewResult(row);
}

export async function createReview(
  userId: number,
  input: CreateReviewBody,
): Promise<ReviewResult> {
  const product = await reviewRepository.findProductIdByPublicId(
    input.product_public_id,
  );

  if (!product) {
    throw new NotFoundError("Product not found");
  }

  const existing = await reviewRepository.findExistingReviewByUserAndProduct(
    userId,
    product.id,
  );

  if (existing) {
    throw new ConflictError("You have already reviewed this product");
  }

  if (REVIEWS_REQUIRE_PURCHASE) {
    const purchase = await reviewRepository.hasQualifyingPurchase(
      userId,
      product.id,
    );
    if (!purchase) {
      throw new ConflictError(
        "You can only review a product you have purchased",
      );
    }
  }

  const images = input.images ?? [];

  const row = await prisma.$transaction(async (tx) => {
    const created = await reviewRepository.createReview(
      {
        public_id: generatePublicId(PUBLIC_ID_PREFIXES.REVIEW),
        users_id: userId,
        products_id: product.id,
        rating: input.rating,
        title: input.title ?? null,
        comment: input.comment ?? null,
      },
      tx,
    );

    if (images.length > 0) {
      await reviewRepository.createReviewImages(
        created.id,
        images.map((image, index) => ({
          public_id: newReviewImagePublicId(),
          image_url: image.image_url,
          alt_text: image.alt_text ?? null,
          display_order: index + 1,
        })),
        tx,
      );
    }

    const refreshed = await reviewRepository.findOwnReviewByPublicId(
      created.public_id,
      userId,
      tx,
    );
    return refreshed!;
  });

  return toReviewResult(row);
}

export async function updateReview(
  userId: number,
  reviewPublicId: string,
  input: UpdateReviewBody,
): Promise<ReviewResult> {
  const existing = await reviewRepository.findOwnReviewByPublicId(
    reviewPublicId,
    userId,
  );

  if (!existing) {
    throw new NotFoundError("Review not found");
  }

  const row = await prisma.$transaction(async (tx) => {
    const updated = await reviewRepository.updateReview(
      existing.id,
      {
        rating: input.rating,
        title: input.title,
        comment: input.comment,
      },
      tx,
    );

    if (input.images !== undefined) {
      await reviewRepository.deleteReviewImages(existing.id, tx);
      if (input.images.length > 0) {
        await reviewRepository.createReviewImages(
          existing.id,
          input.images.map((image, index) => ({
            public_id: newReviewImagePublicId(),
            image_url: image.image_url,
            alt_text: image.alt_text ?? null,
            display_order: index + 1,
          })),
          tx,
        );
      }
    }

    const refreshed = await reviewRepository.findOwnReviewByPublicId(
      updated.public_id,
      userId,
      tx,
    );
    return refreshed!;
  });

  return toReviewResult(row);
}

export async function deleteReview(
  userId: number,
  reviewPublicId: string,
): Promise<void> {
  const existing = await reviewRepository.findOwnReviewByPublicId(
    reviewPublicId,
    userId,
  );

  if (!existing) {
    throw new NotFoundError("Review not found");
  }

  await prisma.$transaction(async (tx) => {
    await reviewRepository.softDeleteReview(existing.id, tx);
    await reviewRepository.deleteReviewImages(existing.id, tx);
  });
}

export async function listOwnReviews(
  userId: number,
  page: number,
  limit: number,
  sort: string,
): Promise<ListOwnReviewsResult> {
  const { field, direction } = parseSort(sort);
  const orderBy: Prisma.reviewsOrderByWithRelationInput =
    field === "rating" ? { rating: direction } : { created_at: direction };
  const filters = { users_id: userId };

  const [rows, total] = await Promise.all([
    reviewRepository.listOwnReviews(filters, orderBy, direction, (page - 1) * limit, limit),
    reviewRepository.countOwnReviews(filters),
  ]);

  return {
    reviews: rows.map(toOwnReviewResult),
    pagination: formatPaginationMeta(page, limit, total),
  };
}
