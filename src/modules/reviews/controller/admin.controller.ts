import { Request, Response, NextFunction } from "express";
import {
  deleteReviewAdmin,
  getAdminReview,
  listAdminReviews,
  moderateReview,
} from "../service/admin.service.js";
import type {
  AdminReviewParams,
  ListAdminReviewsQuery,
  ModerateReviewBody,
} from "../validators/admin.js";

export async function listAdminReviewsController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const {
      page,
      limit,
      search,
      rating,
      is_approved,
      include_deleted,
      sort,
    } = req.query as unknown as ListAdminReviewsQuery;
    const result = await listAdminReviews(
      page,
      limit,
      search,
      rating,
      is_approved,
      include_deleted,
      sort,
    );
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

export async function getAdminReviewController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { review_public_id } = req.params as AdminReviewParams;
    const data = await getAdminReview(review_public_id);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function moderateReviewController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { review_public_id } = req.params as AdminReviewParams;
    const data = await moderateReview(
      review_public_id,
      req.body as ModerateReviewBody,
      { id: req.user!.id },
    );
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteReviewAdminController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { review_public_id } = req.params as AdminReviewParams;
    await deleteReviewAdmin(review_public_id, { id: req.user!.id });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
