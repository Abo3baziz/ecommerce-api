import { describe, it, expect, beforeEach } from "vitest";
import { nanoid } from "nanoid";
import { Prisma } from "../../../src/generated/prisma/client.js";
import { order_status } from "../../../src/generated/prisma/enums.js";
import {
  createReview as createReviewService,
  deleteReview as deleteReviewService,
  getReview,
  listOwnReviews,
  listProductReviews,
  updateReview as updateReviewService,
} from "../../../src/modules/reviews/service/review.service.js";
import {
  deleteReviewAdmin,
  getAdminReview,
  listAdminReviews,
  moderateReview,
} from "../../../src/modules/reviews/service/admin.service.js";
import { reviewRepository } from "../../../src/modules/reviews/repository/review.repository.js";
import { BadRequestError } from "../../../src/shared/errors/BadRequestError.js";
import { ConflictError } from "../../../src/shared/errors/ConflictError.js";
import { NotFoundError } from "../../../src/shared/errors/NotFoundError.js";
import { PUBLIC_ID_PREFIXES } from "../../../src/shared/constants/index.js";
import { generatePublicId } from "../../../src/shared/utils/index.js";
import { prisma } from "../../../src/config/database.js";
import { cleanupTestData } from "../../helpers/db.js";
import { createUser } from "../../factories/user.factory.js";
import { createProduct } from "../../factories/product.factory.js";
import { createVariant } from "../../factories/variant.factory.js";
import { createAddress } from "../../factories/address.factory.js";
import {
  createReview,
  createReviewImage,
} from "../../factories/review.factory.js";

function reviewInput(overrides: Record<string, unknown> = {}) {
  return {
    product_public_id: "prd_placeholder",
    rating: 5,
    title: "Excellent quality",
    comment: "The fabric feels premium.",
    images: [
      { image_url: "https://example.com/reviews/a.jpg", alt_text: "alt a" },
    ],
    ...overrides,
  };
}

describe("reviews.service", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("listProductReviews", () => {
    it("returns only approved, non-deleted reviews with a rating summary", async () => {
      const user = await createUser();
      const product = await createProduct();
      const approved = await createReview({
        users_id: user.id,
        products_id: product.id,
        rating: 5,
      });
      await createReview({
        users_id: user.id,
        products_id: product.id,
        rating: 3,
        is_approved: false,
      });
      const otherUser = await createUser();
      const deletedProduct = await createProduct();
      await createReview({
        users_id: otherUser.id,
        products_id: product.id,
        rating: 4,
        deleted_at: new Date(),
      });
      await createReview({
        users_id: otherUser.id,
        products_id: deletedProduct.id,
        rating: 2,
      });

      const result = await listProductReviews(product.public_id, 1, 20, undefined, "-created_at");

      expect(result.reviews).toHaveLength(1);
      expect(result.reviews[0].public_id).toBe(approved.public_id);
      expect(result.reviews[0].customer_name).toBe(`${user.first_name} ${user.last_name}`);
      expect(result.reviews[0]).not.toHaveProperty("is_approved");
      expect(result.reviews[0]).not.toHaveProperty("deleted_at");
      expect(result.reviews[0]).not.toHaveProperty("id");
      expect(result.reviews[0]).not.toHaveProperty("customer_email");
      expect(result.summary).toEqual({ average_rating: 5, total_count: 1 });
      expect(result.pagination.total).toBe(1);
    });

    it("rounds the average rating to 2 decimal places", async () => {
      const user = await createUser();
      const product = await createProduct();
      await createReview({ users_id: user.id, products_id: product.id, rating: 5 });
      await createReview({ users_id: user.id, products_id: product.id, rating: 4 });

      const result = await listProductReviews(product.public_id, 1, 20, undefined, "-created_at");

      expect(result.summary.average_rating).toBe(4.5);
    });

    it("returns null average and zero count for an empty set", async () => {
      const product = await createProduct();

      const result = await listProductReviews(product.public_id, 1, 20, undefined, "-created_at");

      expect(result.reviews).toEqual([]);
      expect(result.summary).toEqual({ average_rating: null, total_count: 0 });
    });

    it("filters by exact rating", async () => {
      const user = await createUser();
      const product = await createProduct();
      const fiveStar = await createReview({
        users_id: user.id,
        products_id: product.id,
        rating: 5,
      });
      await createReview({ users_id: user.id, products_id: product.id, rating: 3 });

      const result = await listProductReviews(product.public_id, 1, 20, 5, "-created_at");

      expect(result.reviews.map((review) => review.public_id)).toEqual([
        fiveStar.public_id,
      ]);
      expect(result.summary.total_count).toBe(1);
    });

    it("reports pagination metadata", async () => {
      const user = await createUser();
      const product = await createProduct();
      for (let index = 0; index < 3; index += 1) {
        await createReview({ users_id: user.id, products_id: product.id });
      }

      const result = await listProductReviews(product.public_id, 2, 2, undefined, "-created_at");

      expect(result.reviews).toHaveLength(1);
      expect(result.pagination).toEqual({
        page: 2,
        limit: 2,
        total: 3,
        totalPages: 2,
        hasNext: false,
        hasPrev: true,
      });
    });

    it("sorts by rating ascending", async () => {
      const user = await createUser();
      const product = await createProduct();
      const low = await createReview({ users_id: user.id, products_id: product.id, rating: 2 });
      const high = await createReview({ users_id: user.id, products_id: product.id, rating: 4 });

      const result = await listProductReviews(product.public_id, 1, 20, undefined, "rating");

      expect(result.reviews.map((review) => review.public_id)).toEqual([
        low.public_id,
        high.public_id,
      ]);
    });

    it("throws NotFoundError for a missing product", async () => {
      await expect(
        listProductReviews("prd_unknown", 1, 20, undefined, "-created_at"),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for a soft-deleted product", async () => {
      const product = await createProduct({ deleted_at: new Date() });

      await expect(
        listProductReviews(product.public_id, 1, 20, undefined, "-created_at"),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("getReview", () => {
    it("returns a single approved review", async () => {
      const user = await createUser();
      const product = await createProduct();
      const review = await createReview({
        users_id: user.id,
        products_id: product.id,
      });
      await createReviewImage({ reviews_id: review.id, display_order: 1 });

      const result = await getReview(review.public_id);

      expect(result.public_id).toBe(review.public_id);
      expect(result.images).toHaveLength(1);
      expect(result.images[0].display_order).toBe(1);
      expect(result).not.toHaveProperty("is_approved");
      expect(result).not.toHaveProperty("deleted_at");
    });

    it("throws NotFoundError for an unapproved review", async () => {
      const user = await createUser();
      const product = await createProduct();
      const review = await createReview({
        users_id: user.id,
        products_id: product.id,
        is_approved: false,
      });

      await expect(getReview(review.public_id)).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for a soft-deleted review", async () => {
      const user = await createUser();
      const product = await createProduct();
      const review = await createReview({
        users_id: user.id,
        products_id: product.id,
        deleted_at: new Date(),
      });

      await expect(getReview(review.public_id)).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for a review of a soft-deleted product", async () => {
      const user = await createUser();
      const product = await createProduct({ deleted_at: new Date() });
      const review = await createReview({
        users_id: user.id,
        products_id: product.id,
      });

      await expect(getReview(review.public_id)).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for an unknown review", async () => {
      await expect(getReview("rev_unknown")).rejects.toThrow(NotFoundError);
    });
  });

  describe("createReview", () => {
    it("creates a review with images ordered by array index", async () => {
      const user = await createUser();
      const product = await createProduct();

      const result = await createReviewService(
        user.id,
        reviewInput({ product_public_id: product.public_id, images: [
          { image_url: "https://example.com/reviews/1.jpg" },
          { image_url: "https://example.com/reviews/2.jpg", alt_text: "second" },
        ] }),
      );

      expect(result.public_id).toMatch(/^rev_/);
      expect(result.product_public_id).toBe(product.public_id);
      expect(result.customer_name).toBe(`${user.first_name} ${user.last_name}`);
      expect(result.images.map((image) => image.display_order)).toEqual([1, 2]);
      expect(result.images.map((image) => image.image_url)).toEqual([
        "https://example.com/reviews/1.jpg",
        "https://example.com/reviews/2.jpg",
      ]);
      expect(result).not.toHaveProperty("is_approved");
      expect(result).not.toHaveProperty("id");

      const stored = await prisma.reviews.findUnique({
        where: { public_id: result.public_id },
      });
      expect(stored!.is_approved).toBe(true);
    });

    it("creates a review without images", async () => {
      const user = await createUser();
      const product = await createProduct();

      const result = await createReviewService(
        user.id,
        reviewInput({
          product_public_id: product.public_id,
          images: undefined,
        }),
      );

      expect(result.images).toEqual([]);
    });

    it("throws NotFoundError for a soft-deleted product", async () => {
      const user = await createUser();
      const product = await createProduct({ deleted_at: new Date() });

      await expect(
        createReviewService(user.id, reviewInput({ product_public_id: product.public_id })),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws ConflictError for a duplicate review", async () => {
      const user = await createUser();
      const product = await createProduct();
      await createReview({ users_id: user.id, products_id: product.id });

      await expect(
        createReviewService(user.id, reviewInput({ product_public_id: product.public_id })),
      ).rejects.toThrow(ConflictError);
    });

    it("allows a new review after the previous one was soft-deleted", async () => {
      const user = await createUser();
      const product = await createProduct();
      const existing = await createReview({ users_id: user.id, products_id: product.id });
      await prisma.reviews.update({
        where: { id: existing.id },
        data: { deleted_at: new Date() },
      });

      const result = await createReviewService(
        user.id,
        reviewInput({ product_public_id: product.public_id }),
      );

      expect(result.public_id).not.toBe(existing.public_id);
    });
  });

  describe("updateReview", () => {
    it("updates only the provided fields", async () => {
      const user = await createUser();
      const product = await createProduct();
      const review = await createReview({
        users_id: user.id,
        products_id: product.id,
        rating: 5,
        title: "Original",
        comment: "Original comment",
      });

      const result = await updateReviewService(user.id, review.public_id, {
        rating: 4,
      });

      expect(result.rating).toBe(4);
      expect(result.title).toBe("Original");
      expect(result.comment).toBe("Original comment");
    });

    it("clears title and comment with null", async () => {
      const user = await createUser();
      const product = await createProduct();
      const review = await createReview({
        users_id: user.id,
        products_id: product.id,
        title: "Original",
        comment: "Original comment",
      });

      const result = await updateReviewService(user.id, review.public_id, {
        title: null,
        comment: null,
      });

      expect(result.title).toBeNull();
      expect(result.comment).toBeNull();
    });

    it("replaces the whole image set when images is provided", async () => {
      const user = await createUser();
      const product = await createProduct();
      const review = await createReview({ users_id: user.id, products_id: product.id });
      await createReviewImage({ reviews_id: review.id, display_order: 1 });

      const result = await updateReviewService(user.id, review.public_id, {
        images: [
          { image_url: "https://example.com/reviews/new1.jpg" },
          { image_url: "https://example.com/reviews/new2.jpg" },
        ],
      });

      expect(result.images.map((image) => image.image_url)).toEqual([
        "https://example.com/reviews/new1.jpg",
        "https://example.com/reviews/new2.jpg",
      ]);
      expect(result.images.map((image) => image.display_order)).toEqual([1, 2]);
    });

    it("clears all images when an empty array is provided", async () => {
      const user = await createUser();
      const product = await createProduct();
      const review = await createReview({ users_id: user.id, products_id: product.id });
      await createReviewImage({ reviews_id: review.id, display_order: 1 });

      const result = await updateReviewService(user.id, review.public_id, {
        images: [],
      });

      expect(result.images).toEqual([]);
    });

    it("leaves images untouched when images is omitted", async () => {
      const user = await createUser();
      const product = await createProduct();
      const review = await createReview({ users_id: user.id, products_id: product.id });
      await createReviewImage({ reviews_id: review.id, display_order: 1 });

      const result = await updateReviewService(user.id, review.public_id, {
        comment: "Edited comment",
      });

      expect(result.images).toHaveLength(1);
      expect(result.comment).toBe("Edited comment");
    });

    it("does not reset is_approved", async () => {
      const user = await createUser();
      const product = await createProduct();
      const review = await createReview({
        users_id: user.id,
        products_id: product.id,
        is_approved: false,
      });

      const result = await updateReviewService(user.id, review.public_id, {
        comment: "Edited",
      });

      expect(result).not.toHaveProperty("is_approved");
      const stored = await prisma.reviews.findUnique({
        where: { public_id: review.public_id },
      });
      expect(stored!.is_approved).toBe(false);
    });

    it("throws NotFoundError for a review owned by another user", async () => {
      const owner = await createUser();
      const other = await createUser();
      const product = await createProduct();
      const review = await createReview({ users_id: owner.id, products_id: product.id });

      await expect(
        updateReviewService(other.id, review.public_id, { rating: 3 }),
      ).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError for a soft-deleted review", async () => {
      const user = await createUser();
      const product = await createProduct();
      const review = await createReview({
        users_id: user.id,
        products_id: product.id,
        deleted_at: new Date(),
      });

      await expect(
        updateReviewService(user.id, review.public_id, { rating: 3 }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("deleteReview", () => {
    it("soft-deletes the review and hard-deletes its images in one transaction", async () => {
      const user = await createUser();
      const product = await createProduct();
      const review = await createReview({ users_id: user.id, products_id: product.id });
      const image = await createReviewImage({ reviews_id: review.id });

      await deleteReviewService(user.id, review.public_id);

      const stored = await prisma.reviews.findUnique({
        where: { public_id: review.public_id },
      });
      expect(stored!.deleted_at).not.toBeNull();

      const images = await prisma.review_images.findMany({
        where: { id: image.id },
      });
      expect(images).toHaveLength(0);
    });

    it("throws NotFoundError for a review owned by another user", async () => {
      const owner = await createUser();
      const other = await createUser();
      const product = await createProduct();
      const review = await createReview({ users_id: owner.id, products_id: product.id });

      await expect(deleteReviewService(other.id, review.public_id)).rejects.toThrow(
        NotFoundError,
      );
    });

    it("throws NotFoundError for an already deleted review", async () => {
      const user = await createUser();
      const product = await createProduct();
      const review = await createReview({
        users_id: user.id,
        products_id: product.id,
        deleted_at: new Date(),
      });

      await expect(deleteReviewService(user.id, review.public_id)).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  describe("listOwnReviews", () => {
    it("returns the user's own reviews including unapproved ones", async () => {
      const user = await createUser();
      const other = await createUser();
      const product = await createProduct();
      const approved = await createReview({
        users_id: user.id,
        products_id: product.id,
      });
      const unapproved = await createReview({
        users_id: user.id,
        products_id: product.id,
        is_approved: false,
        rating: 2,
      });
      await createReview({ users_id: user.id, products_id: product.id, deleted_at: new Date() });
      await createReview({ users_id: other.id, products_id: product.id });

      const result = await listOwnReviews(user.id, 1, 20, "-created_at");

      expect(result.reviews.map((review) => review.public_id)).toEqual([
        unapproved.public_id,
        approved.public_id,
      ]);
      expect(result.reviews[0].is_approved).toBe(false);
      expect(result.reviews[1].is_approved).toBe(true);
      expect(result.pagination.total).toBe(2);
    });

    it("sorts by rating descending", async () => {
      const user = await createUser();
      const product = await createProduct();
      const low = await createReview({ users_id: user.id, products_id: product.id, rating: 2 });
      const high = await createReview({ users_id: user.id, products_id: product.id, rating: 5 });

      const result = await listOwnReviews(user.id, 1, 20, "-rating");

      expect(result.reviews.map((review) => review.public_id)).toEqual([
        high.public_id,
        low.public_id,
      ]);
    });
  });

  describe("hasQualifyingPurchase", () => {
    async function createOrderWithItem(
      user: { id: number },
      variant: { id: number },
      status: order_status,
    ) {
      const now = new Date();
      const address = await createAddress(user.id);
      const order = await prisma.orders.create({
        data: {
          public_id: generatePublicId(PUBLIC_ID_PREFIXES.ORDER),
          order_number: `ORD-${nanoid(10)}`,
          status,
          shipping_cost: new Prisma.Decimal("10.00"),
          subtotal: new Prisma.Decimal("100.00"),
          discount_amount: new Prisma.Decimal("0.00"),
          shipping_fee: new Prisma.Decimal("10.00"),
          tax_amount: new Prisma.Decimal("0.00"),
          total_amount: new Prisma.Decimal("110.00"),
          notes: null,
          placed_at: now,
          created_at: now,
          updated_at: now,
          users_id: user.id,
          coupons_id: null,
          user_addresses_id: address.id,
        },
      });

      await prisma.order_items.create({
        data: {
          orders_id: order.id,
          product_variants_id: variant.id,
          product_name: "Test Product",
          product_slug: "test-product",
          sku: `SKU-${nanoid(8)}`,
          variant_color: "Black",
          variant_size: "M",
          discount_percentage: "0.00",
          unit_price: new Prisma.Decimal("100.00"),
          quantity: 1,
          total_amount: new Prisma.Decimal("100.00"),
          created_at: now,
        },
      });

      return order;
    }

    it("returns true when a qualifying order exists", async () => {
      const user = await createUser();
      const product = await createProduct();
      const variant = await createVariant(product.id);
      await createOrderWithItem(user, variant, order_status.DELIVERED);

      const result = await reviewRepository.hasQualifyingPurchase(user.id, product.id);
      expect(result).not.toBeNull();
    });

    it("returns null when only a pending or cancelled order exists", async () => {
      const user = await createUser();
      const product = await createProduct();
      const variant = await createVariant(product.id);
      await createOrderWithItem(user, variant, order_status.PENDING);

      const result = await reviewRepository.hasQualifyingPurchase(user.id, product.id);
      expect(result).toBeNull();
    });

    it("returns null when the user never ordered the product", async () => {
      const user = await createUser();
      const product = await createProduct();

      const result = await reviewRepository.hasQualifyingPurchase(user.id, product.id);
      expect(result).toBeNull();
    });
  });

  describe("admin reviews", () => {
    it("lists all reviews and excludes soft-deleted by default", async () => {
      const user = await createUser();
      const product = await createProduct();
      const active = await createReview({ users_id: user.id, products_id: product.id });
      await createReview({ users_id: user.id, products_id: product.id, deleted_at: new Date() });

      const result = await listAdminReviews(1, 20, undefined, undefined, undefined, false, "-created_at");

      expect(result.reviews.map((review) => review.public_id)).toEqual([active.public_id]);
      expect(result.reviews[0]).toHaveProperty("customer_email");
      expect(result.reviews[0]).toHaveProperty("is_approved");
      expect(result.reviews[0]).not.toHaveProperty("deleted_at");
      expect(result.reviews[0].images).toEqual([]);
    });

    it("includes soft-deleted reviews when include_deleted is true", async () => {
      const user = await createUser();
      const product = await createProduct();
      const deleted = await createReview({
        users_id: user.id,
        products_id: product.id,
        deleted_at: new Date(),
      });

      const result = await listAdminReviews(1, 20, undefined, undefined, undefined, true, "-created_at");

      expect(result.reviews.map((review) => review.public_id)).toContain(deleted.public_id);
      expect(result.reviews[0].deleted_at).not.toBeNull();
    });

    it("filters by is_approved", async () => {
      const user = await createUser();
      const product = await createProduct();
      await createReview({ users_id: user.id, products_id: product.id });
      const unapproved = await createReview({
        users_id: user.id,
        products_id: product.id,
        is_approved: false,
      });

      const result = await listAdminReviews(1, 20, undefined, undefined, false, false, "-created_at");

      expect(result.reviews.map((review) => review.public_id)).toEqual([unapproved.public_id]);
    });

    it("filters by rating", async () => {
      const user = await createUser();
      const product = await createProduct();
      const fiveStar = await createReview({ users_id: user.id, products_id: product.id, rating: 5 });
      await createReview({ users_id: user.id, products_id: product.id, rating: 1 });

      const result = await listAdminReviews(1, 20, undefined, 5, undefined, false, "-created_at");

      expect(result.reviews.map((review) => review.public_id)).toEqual([fiveStar.public_id]);
    });

    it("searches across product name, title, comment, email, and customer name", async () => {
      const user = await createUser();
      const product = await createProduct({ name: "Cotton T-Shirt" });
      const byTitle = await createReview({
        users_id: user.id,
        products_id: product.id,
        title: "SearchableTitle",
      });
      const byComment = await createReview({
        users_id: user.id,
        products_id: product.id,
        comment: "SearchableComment",
      });
      await createReview({ users_id: user.id, products_id: product.id });

      const byProductName = await listAdminReviews(1, 20, "Cotton", undefined, undefined, false, "-created_at");
      expect(byProductName.reviews).toHaveLength(3);

      const byTitleResult = await listAdminReviews(1, 20, "SearchableTitle", undefined, undefined, false, "-created_at");
      expect(byTitleResult.reviews.map((review) => review.public_id)).toEqual([byTitle.public_id]);

      const byCommentResult = await listAdminReviews(1, 20, "SearchableComment", undefined, undefined, false, "-created_at");
      expect(byCommentResult.reviews.map((review) => review.public_id)).toEqual([byComment.public_id]);

      const byEmail = await listAdminReviews(1, 20, user.email, undefined, undefined, false, "-created_at");
      expect(byEmail.reviews).toHaveLength(3);

      const byName = await listAdminReviews(1, 20, `${user.first_name} ${user.last_name}`, undefined, undefined, false, "-created_at");
      expect(byName.reviews).toHaveLength(3);
    });

    it("treats LIKE wildcards in search literally", async () => {
      const user = await createUser();
      const product = await createProduct();
      await createReview({ users_id: user.id, products_id: product.id, comment: "100% genuine" });
      await createReview({ users_id: user.id, products_id: product.id, comment: "plain text" });

      const result = await listAdminReviews(1, 20, "100%", undefined, undefined, false, "-created_at");

      expect(result.reviews).toHaveLength(1);
      expect(result.reviews[0].comment).toBe("100% genuine");
    });

    it("sorts by rating descending", async () => {
      const user = await createUser();
      const product = await createProduct();
      const low = await createReview({ users_id: user.id, products_id: product.id, rating: 1 });
      const high = await createReview({ users_id: user.id, products_id: product.id, rating: 5 });

      const result = await listAdminReviews(1, 20, undefined, undefined, undefined, false, "-rating");

      expect(result.reviews.map((review) => review.public_id)).toEqual([
        high.public_id,
        low.public_id,
      ]);
    });
  });

  describe("admin review detail and moderation", () => {
    it("returns a review in any state with images", async () => {
      const user = await createUser();
      const product = await createProduct();
      const review = await createReview({
        users_id: user.id,
        products_id: product.id,
        is_approved: false,
        deleted_at: new Date(),
      });
      await createReviewImage({ reviews_id: review.id, display_order: 1 });

      const result = await getAdminReview(review.public_id);

      expect(result.is_approved).toBe(false);
      expect(result.deleted_at).not.toBeNull();
      expect(result.images).toHaveLength(1);
      expect(result.customer_public_id).toBe(user.public_id);
      expect(result.customer_email).toBe(user.email);
    });

    it("throws NotFoundError for an unknown review", async () => {
      await expect(getAdminReview("rev_unknown")).rejects.toThrow(NotFoundError);
    });

    it("moderates is_approved and content", async () => {
      const user = await createUser();
      const product = await createProduct();
      const review = await createReview({
        users_id: user.id,
        products_id: product.id,
        is_approved: true,
      });

      const result = await moderateReview(
        review.public_id,
        { is_approved: false, comment: "Edited by support" },
        { id: user.id },
      );

      expect(result.is_approved).toBe(false);
      expect(result.comment).toBe("Edited by support");
    });

    it("clears title with null", async () => {
      const user = await createUser();
      const product = await createProduct();
      const review = await createReview({
        users_id: user.id,
        products_id: product.id,
        title: "Original title",
      });

      const result = await moderateReview(review.public_id, { title: null }, { id: user.id });

      expect(result.title).toBeNull();
    });

    it("throws BadRequestError when approving a soft-deleted review", async () => {
      const user = await createUser();
      const product = await createProduct();
      const review = await createReview({
        users_id: user.id,
        products_id: product.id,
        deleted_at: new Date(),
      });

      await expect(
        moderateReview(review.public_id, { is_approved: true }, { id: user.id }),
      ).rejects.toThrow(BadRequestError);
    });

    it("throws NotFoundError when moderating an unknown review", async () => {
      await expect(
        moderateReview("rev_unknown", { is_approved: true }, { id: 1 }),
      ).rejects.toThrow(NotFoundError);
    });

    it("soft-deletes a review and its images via admin delete", async () => {
      const user = await createUser();
      const product = await createProduct();
      const review = await createReview({ users_id: user.id, products_id: product.id });
      const image = await createReviewImage({ reviews_id: review.id });

      await deleteReviewAdmin(review.public_id, { id: user.id });

      const stored = await prisma.reviews.findUnique({
        where: { public_id: review.public_id },
      });
      expect(stored!.deleted_at).not.toBeNull();

      const images = await prisma.review_images.findMany({
        where: { id: image.id },
      });
      expect(images).toHaveLength(0);
    });

    it("throws NotFoundError when deleting an unknown review via admin", async () => {
      await expect(deleteReviewAdmin("rev_unknown", { id: 1 })).rejects.toThrow(
        NotFoundError,
      );
    });
  });
});
