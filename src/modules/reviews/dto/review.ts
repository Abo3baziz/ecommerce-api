import type {
  CreateReviewBody,
  UpdateReviewBody,
} from "../validators/review.js";
import type { ModerateReviewBody } from "../validators/admin.js";
import type { PaginationMeta } from "./common.js";

export type { CreateReviewBody, UpdateReviewBody, ModerateReviewBody };

export interface ReviewImageResult {
  public_id: string;
  image_url: string;
  alt_text: string | null;
  display_order: number | null;
}

export interface ReviewResult {
  public_id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  customer_name: string;
  product_public_id: string;
  product_name: string;
  product_slug: string;
  images: ReviewImageResult[];
  created_at: Date;
  updated_at: Date;
}

export interface OwnReviewResult extends ReviewResult {
  is_approved: boolean;
}

export interface AdminReviewResult extends ReviewResult {
  is_approved: boolean;
  customer_public_id: string;
  customer_email: string;
  deleted_at?: Date | null;
}

export interface RatingSummaryResult {
  average_rating: number | null;
  total_count: number;
}

export interface ListProductReviewsResult {
  summary: RatingSummaryResult;
  reviews: ReviewResult[];
  pagination: PaginationMeta;
}

export interface ListOwnReviewsResult {
  reviews: OwnReviewResult[];
  pagination: PaginationMeta;
}

export interface ListAdminReviewsResult {
  reviews: AdminReviewResult[];
  pagination: PaginationMeta;
}
