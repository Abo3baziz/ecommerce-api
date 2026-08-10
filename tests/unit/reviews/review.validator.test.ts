import { describe, it, expect } from "vitest";
import {
  createReviewSchema,
  listOwnReviewsSchema,
  listProductReviewsSchema,
  reviewParamsSchema,
  updateReviewSchema,
} from "../../../src/modules/reviews/validators/review.js";
import {
  adminReviewParamsSchema,
  listAdminReviewsSchema,
  moderateReviewSchema,
} from "../../../src/modules/reviews/validators/admin.js";

describe("createReviewSchema", () => {
  const validBody = {
    product_public_id: "prd_abc",
    rating: 5,
  };

  it("accepts a valid payload", () => {
    const result = createReviewSchema.safeParse({ body: validBody });
    expect(result.success).toBe(true);
  });

  it("accepts optional title, comment, and images", () => {
    const result = createReviewSchema.safeParse({
      body: {
        ...validBody,
        title: "Great",
        comment: "Loved it",
        images: [
          { image_url: "https://example.com/a.jpg", alt_text: "alt" },
          { image_url: "https://example.com/b.jpg" },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty images array", () => {
    const result = createReviewSchema.safeParse({
      body: { ...validBody, images: [] },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing product_public_id", () => {
    const result = createReviewSchema.safeParse({ body: { rating: 5 } });
    expect(result.success).toBe(false);
  });

  it("rejects a rating below 1", () => {
    const result = createReviewSchema.safeParse({
      body: { ...validBody, rating: 0 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a rating above 5", () => {
    const result = createReviewSchema.safeParse({
      body: { ...validBody, rating: 6 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer rating", () => {
    const result = createReviewSchema.safeParse({
      body: { ...validBody, rating: 4.5 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a title longer than 255 characters", () => {
    const result = createReviewSchema.safeParse({
      body: { ...validBody, title: "T".repeat(256) },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a comment longer than 5000 characters", () => {
    const result = createReviewSchema.safeParse({
      body: { ...validBody, comment: "C".repeat(5001) },
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 5 images", () => {
    const result = createReviewSchema.safeParse({
      body: {
        ...validBody,
        images: Array.from({ length: 6 }, (_, index) => ({
          image_url: `https://example.com/${index}.jpg`,
        })),
      },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a relative image_url", () => {
    const result = createReviewSchema.safeParse({
      body: { ...validBody, images: [{ image_url: "/local/path.jpg" }] },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an image_url with a non-http protocol", () => {
    const result = createReviewSchema.safeParse({
      body: { ...validBody, images: [{ image_url: "ftp://example.com/a.jpg" }] },
    });
    expect(result.success).toBe(false);
  });

  it("rejects an alt_text longer than 255 characters", () => {
    const result = createReviewSchema.safeParse({
      body: {
        ...validBody,
        images: [{ image_url: "https://example.com/a.jpg", alt_text: "A".repeat(256) }],
      },
    });
    expect(result.success).toBe(false);
  });
});

describe("listProductReviewsSchema", () => {
  it("defaults sort to -created_at and pagination to page 1 limit 20", () => {
    const result = listProductReviewsSchema.safeParse({
      params: { product_public_id: "prd_abc" },
      query: {},
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.sort).toBe("-created_at");
      expect(result.data.query.page).toBe(1);
      expect(result.data.query.limit).toBe(20);
    }
  });

  it("accepts created_at and rating sort fields", () => {
    for (const sort of ["created_at", "rating", "-created_at", "-rating"]) {
      const result = listProductReviewsSchema.safeParse({
        params: { product_public_id: "prd_abc" },
        query: { sort },
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects an unsupported sort field", () => {
    const result = listProductReviewsSchema.safeParse({
      params: { product_public_id: "prd_abc" },
      query: { sort: "customer_name" },
    });
    expect(result.success).toBe(false);
  });

  it("accepts a rating filter of 1-5", () => {
    for (const rating of [1, 3, 5]) {
      const result = listProductReviewsSchema.safeParse({
        params: { product_public_id: "prd_abc" },
        query: { rating },
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects a rating filter outside 1-5", () => {
    const result = listProductReviewsSchema.safeParse({
      params: { product_public_id: "prd_abc" },
      query: { rating: 6 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing product_public_id", () => {
    const result = listProductReviewsSchema.safeParse({ params: {} });
    expect(result.success).toBe(false);
  });

  it("rejects a limit above 100", () => {
    const result = listProductReviewsSchema.safeParse({
      params: { product_public_id: "prd_abc" },
      query: { limit: 101 },
    });
    expect(result.success).toBe(false);
  });
});

describe("reviewParamsSchema", () => {
  it("accepts a valid review_public_id", () => {
    const result = reviewParamsSchema.safeParse({
      params: { review_public_id: "rev_abc" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing review_public_id", () => {
    const result = reviewParamsSchema.safeParse({ params: {} });
    expect(result.success).toBe(false);
  });
});

describe("updateReviewSchema", () => {
  it("accepts a partial update body", () => {
    const result = updateReviewSchema.safeParse({
      params: { review_public_id: "rev_abc" },
      body: { rating: 4 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts null to clear title and comment", () => {
    const result = updateReviewSchema.safeParse({
      params: { review_public_id: "rev_abc" },
      body: { title: null, comment: null },
    });
    expect(result.success).toBe(true);
  });

  it("accepts an images replacement array", () => {
    const result = updateReviewSchema.safeParse({
      params: { review_public_id: "rev_abc" },
      body: { images: [{ image_url: "https://example.com/new.jpg" }] },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty body", () => {
    const result = updateReviewSchema.safeParse({
      params: { review_public_id: "rev_abc" },
      body: {},
    });
    expect(result.success).toBe(false);
  });

  it("rejects a rating of 0", () => {
    const result = updateReviewSchema.safeParse({
      params: { review_public_id: "rev_abc" },
      body: { rating: 0 },
    });
    expect(result.success).toBe(false);
  });
});

describe("listOwnReviewsSchema", () => {
  it("defaults sort to -created_at and pagination to page 1 limit 20", () => {
    const result = listOwnReviewsSchema.safeParse({ query: {} });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.sort).toBe("-created_at");
      expect(result.data.query.page).toBe(1);
      expect(result.data.query.limit).toBe(20);
    }
  });

  it("rejects an unsupported sort field", () => {
    const result = listOwnReviewsSchema.safeParse({ query: { sort: "price" } });
    expect(result.success).toBe(false);
  });
});

describe("listAdminReviewsSchema", () => {
  it("defaults include_deleted to false, is_approved to undefined, sort to -created_at", () => {
    const result = listAdminReviewsSchema.safeParse({ query: {} });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.include_deleted).toBe(false);
      expect(result.data.query.is_approved).toBeUndefined();
      expect(result.data.query.sort).toBe("-created_at");
    }
  });

  it("parses is_approved true and false", () => {
    const approved = listAdminReviewsSchema.safeParse({ query: { is_approved: "true" } });
    expect(approved.success).toBe(true);
    if (approved.success) {
      expect(approved.data.query.is_approved).toBe(true);
    }

    const unapproved = listAdminReviewsSchema.safeParse({ query: { is_approved: "false" } });
    expect(unapproved.success).toBe(true);
    if (unapproved.success) {
      expect(unapproved.data.query.is_approved).toBe(false);
    }
  });

  it("treats is_approved=all as undefined", () => {
    const result = listAdminReviewsSchema.safeParse({ query: { is_approved: "all" } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.is_approved).toBeUndefined();
    }
  });

  it("rejects an invalid is_approved value", () => {
    const result = listAdminReviewsSchema.safeParse({ query: { is_approved: "yes" } });
    expect(result.success).toBe(false);
  });

  it("parses include_deleted=true", () => {
    const result = listAdminReviewsSchema.safeParse({ query: { include_deleted: "true" } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.query.include_deleted).toBe(true);
    }
  });

  it("accepts a search term", () => {
    const result = listAdminReviewsSchema.safeParse({ query: { search: "Ahmed" } });
    expect(result.success).toBe(true);
  });

  it("rejects an unsupported sort field", () => {
    const result = listAdminReviewsSchema.safeParse({ query: { sort: "customer_email" } });
    expect(result.success).toBe(false);
  });
});

describe("adminReviewParamsSchema", () => {
  it("accepts a valid review_public_id", () => {
    const result = adminReviewParamsSchema.safeParse({
      params: { review_public_id: "rev_abc" },
    });
    expect(result.success).toBe(true);
  });
});

describe("moderateReviewSchema", () => {
  it("accepts an is_approved toggle", () => {
    const result = moderateReviewSchema.safeParse({
      params: { review_public_id: "rev_abc" },
      body: { is_approved: false },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a comment edit", () => {
    const result = moderateReviewSchema.safeParse({
      params: { review_public_id: "rev_abc" },
      body: { comment: "Edited" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts null to clear title", () => {
    const result = moderateReviewSchema.safeParse({
      params: { review_public_id: "rev_abc" },
      body: { title: null },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty body", () => {
    const result = moderateReviewSchema.safeParse({
      params: { review_public_id: "rev_abc" },
      body: {},
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-boolean is_approved", () => {
    const result = moderateReviewSchema.safeParse({
      params: { review_public_id: "rev_abc" },
      body: { is_approved: "true" },
    });
    expect(result.success).toBe(false);
  });
});
