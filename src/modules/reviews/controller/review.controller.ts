import { Request, Response, NextFunction } from "express";
import {
  createReview,
  deleteReview,
  getReview,
  listOwnReviews,
  listProductReviews,
  updateReview,
} from "../service/review.service.js";
import type {
  CreateReviewBody,
  ListOwnReviewsQuery,
  ListProductReviewsQuery,
  ReviewParams,
  UpdateReviewBody,
} from "../validators/review.js";
import type { ProductReviewParams } from "../validators/product.js";

export async function listProductReviewsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { product_public_id } = req.params as unknown as ProductReviewParams;
    const { page, limit, rating, sort } =
      req.query as unknown as ListProductReviewsQuery;
    const result = await listProductReviews(
      product_public_id,
      page,
      limit,
      rating,
      sort,
    );
    res.status(200).json({
      success: true,
      data: {
        summary: result.summary,
        reviews: result.reviews,
      },
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function getReviewController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { review_public_id } = req.params as ReviewParams;
    const data = await getReview(review_public_id);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function createReviewController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await createReview(req.user!.id, req.body as CreateReviewBody);
    res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateReviewController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { review_public_id } = req.params as ReviewParams;
    const data = await updateReview(
      req.user!.id,
      review_public_id,
      req.body as UpdateReviewBody,
    );
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteReviewController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { review_public_id } = req.params as ReviewParams;
    await deleteReview(req.user!.id, review_public_id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function listOwnReviewsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { page, limit, sort } = req.query as unknown as ListOwnReviewsQuery;
    const result = await listOwnReviews(req.user!.id, page, limit, sort);
    res.status(200).json({
      success: true,
      data: {
        reviews: result.reviews,
      },
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}
