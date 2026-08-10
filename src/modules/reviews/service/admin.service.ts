import { prisma } from "../../../config/database.js";
import { BadRequestError } from "../../../shared/errors/BadRequestError.js";
import { NotFoundError } from "../../../shared/errors/NotFoundError.js";
import { logger } from "../../../shared/logger/index.js";
import { formatPaginationMeta } from "../../../shared/utils/index.js";
import {
  reviewRepository,
  type AdminReviewRowRaw,
  type ReviewRow,
} from "../repository/review.repository.js";
import { parseSort } from "../utils/sort.js";
import { toReviewResult } from "./review.service.js";
import type {
  AdminReviewResult,
  ListAdminReviewsResult,
  ModerateReviewBody,
} from "../dto/review.js";

export function toAdminReviewResult(row: ReviewRow): AdminReviewResult {
  return {
    ...toReviewResult(row),
    is_approved: row.is_approved,
    customer_public_id: row.users.public_id,
    customer_email: row.users.email,
    deleted_at: row.deleted_at,
  };
}

function toAdminListRow(
  row: AdminReviewRowRaw,
  includeDeleted: boolean,
): AdminReviewResult {
  return {
    public_id: row.public_id,
    rating: row.rating,
    title: row.title,
    comment: row.comment,
    customer_name: row.customer_name,
    product_public_id: row.product_public_id,
    product_name: row.product_name,
    product_slug: row.product_slug,
    is_approved: row.is_approved,
    customer_public_id: row.customer_public_id,
    customer_email: row.customer_email,
    images: [],
    created_at: row.created_at,
    updated_at: row.updated_at,
    ...(includeDeleted ? { deleted_at: row.deleted_at } : {}),
  };
}

export async function listAdminReviews(
  page: number,
  limit: number,
  search: string | undefined,
  rating: number | undefined,
  isApproved: boolean | undefined,
  includeDeleted: boolean,
  sort: string,
): Promise<ListAdminReviewsResult> {
  const { field, direction } = parseSort(sort);
  const filters = {
    search,
    rating,
    is_approved: isApproved,
    include_deleted: includeDeleted,
  };

  const [rows, total] = await Promise.all([
    reviewRepository.listAdminReviews(
      filters,
      field === "rating" ? "rating" : "created_at",
      direction,
      (page - 1) * limit,
      limit,
    ),
    reviewRepository.countAdminReviews(filters),
  ]);

  return {
    reviews: rows.map((row) => toAdminListRow(row, includeDeleted)),
    pagination: formatPaginationMeta(page, limit, total),
  };
}

export async function getAdminReview(
  reviewPublicId: string,
): Promise<AdminReviewResult> {
  const row = await reviewRepository.findAdminReviewByPublicId(reviewPublicId);

  if (!row) {
    throw new NotFoundError("Review not found");
  }

  return toAdminReviewResult(row);
}

export interface ModerateReviewActor {
  id: number;
}

export async function moderateReview(
  reviewPublicId: string,
  input: ModerateReviewBody,
  actor: ModerateReviewActor,
): Promise<AdminReviewResult> {
  const existing = await reviewRepository.findAdminReviewByPublicId(
    reviewPublicId,
  );

  if (!existing) {
    throw new NotFoundError("Review not found");
  }

  if (existing.deleted_at !== null && input.is_approved) {
    throw new BadRequestError(
      "Cannot approve a soft-deleted review",
    );
  }

  const changedFields: string[] = [];
  if (input.is_approved !== undefined) {
    changedFields.push("is_approved");
  }
  if (input.rating !== undefined) {
    changedFields.push("rating");
  }
  if (input.title !== undefined) {
    changedFields.push("title");
  }
  if (input.comment !== undefined) {
    changedFields.push("comment");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const result = await reviewRepository.updateReview(
      existing.id,
      {
        is_approved: input.is_approved,
        rating: input.rating,
        title: input.title,
        comment: input.comment,
      },
      tx,
    );
    return result;
  });

  logger.info(
    {
      actorId: actor.id,
      reviewPublicId,
      changedFields,
    },
    "Review moderated",
  );

  return toAdminReviewResult(updated);
}

export interface DeleteReviewActor {
  id: number;
}

export async function deleteReviewAdmin(
  reviewPublicId: string,
  actor: DeleteReviewActor,
): Promise<void> {
  const existing = await reviewRepository.findAdminReviewByPublicId(
    reviewPublicId,
  );

  if (!existing) {
    throw new NotFoundError("Review not found");
  }

  await prisma.$transaction(async (tx) => {
    await reviewRepository.softDeleteReview(existing.id, tx);
    await reviewRepository.deleteReviewImages(existing.id, tx);
  });

  logger.info(
    {
      actorId: actor.id,
      reviewPublicId,
    },
    "Review deleted",
  );
}
