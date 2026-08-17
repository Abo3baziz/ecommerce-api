import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { nanoid } from "nanoid";
import { app } from "../../../src/app/index.js";
import { prisma } from "../../../src/config/database.js";
import { createAdminUser, registerUser, csrfHeaders } from "../../helpers/auth.js";
import { cleanupTestData } from "../../helpers/db.js";
import { createProduct } from "../../factories/product.factory.js";
import {
  createReview,
  createReviewImage,
} from "../../factories/review.factory.js";

async function userByEmail(email: string) {
  return prisma.users.findUnique({ where: { email } });
}

const PRODUCT_REVIEWS_BASE_URL = "/api/v1/products";
const REVIEWS_BASE_URL = "/api/v1/reviews";
const OWN_REVIEWS_BASE_URL = "/api/v1/users/me/reviews";
const ADMIN_REVIEWS_BASE_URL = "/api/v1/admin/reviews";

function reviewPayload(overrides: Record<string, unknown> = {}) {
  return {
    product_public_id: "prd_placeholder",
    rating: 5,
    title: "Excellent quality",
    comment: "The fabric feels premium.",
    ...overrides,
  };
}

describe("reviews API", () => {
  beforeEach(async () => {
    await cleanupTestData();
  });

  describe("public product reviews", () => {
    describe("GET /api/v1/products/:product_public_id/reviews", () => {
      it("returns approved reviews with a rating summary (200)", async () => {
        const { payload } = await registerUser(app);
        const product = await createProduct();
        const storedUser = await userByEmail(payload.email);
        const review = await createReview({
          users_id: storedUser!.id,
          products_id: product.id,
          rating: 5,
        });

        const response = await request(app).get(
          `${PRODUCT_REVIEWS_BASE_URL}/${product.public_id}/reviews`,
        );

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.summary).toEqual({
          average_rating: 5,
          total_count: 1,
        });
        expect(response.body.data.reviews[0].public_id).toBe(review.public_id);
        expect(response.body.data.reviews[0]).not.toHaveProperty("is_approved");
        expect(response.body.data.reviews[0]).not.toHaveProperty("deleted_at");
        expect(response.body.data.reviews[0]).not.toHaveProperty("id");
        expect(response.body.data.reviews[0]).not.toHaveProperty("customer_email");
        expect(response.body.pagination.total).toBe(1);
      });

      it("returns 404 for a soft-deleted product", async () => {
        const product = await createProduct({ deleted_at: new Date() });

        const response = await request(app).get(
          `${PRODUCT_REVIEWS_BASE_URL}/${product.public_id}/reviews`,
        );

        expect(response.status).toBe(404);
        expect(response.body.success).toBe(false);
      });

      it("returns 404 for an unknown product", async () => {
        const response = await request(app).get(
          `${PRODUCT_REVIEWS_BASE_URL}/prd_${nanoid(10)}/reviews`,
        );

        expect(response.status).toBe(404);
      });

      it("rejects an invalid sort field (400)", async () => {
        const product = await createProduct();

        const response = await request(app).get(
          `${PRODUCT_REVIEWS_BASE_URL}/${product.public_id}/reviews?sort=price`,
        );

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe("GET /api/v1/reviews/:review_public_id", () => {
      it("returns a single approved review (200)", async () => {
        const { payload } = await registerUser(app);
        const product = await createProduct();
        const storedUser = await userByEmail(payload.email);
        const review = await createReview({
          users_id: storedUser!.id,
          products_id: product.id,
        });

        const response = await request(app).get(
          `${REVIEWS_BASE_URL}/${review.public_id}`,
        );

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.public_id).toBe(review.public_id);
      });

      it("returns 404 for an unapproved review", async () => {
        const { payload } = await registerUser(app);
        const product = await createProduct();
        const storedUser = await userByEmail(payload.email);
        const review = await createReview({
          users_id: storedUser!.id,
          products_id: product.id,
          is_approved: false,
        });

        const response = await request(app).get(
          `${REVIEWS_BASE_URL}/${review.public_id}`,
        );

        expect(response.status).toBe(404);
      });
    });
  });

  describe("customer review management", () => {
    describe("POST /api/v1/reviews", () => {
      it("creates a review for an authenticated user (201)", async () => {
        const { cookie, csrf } = await registerUser(app);
        const product = await createProduct();

        const response = await request(app)
          .post(REVIEWS_BASE_URL)
          .set(csrfHeaders(cookie!, csrf!))
          .send(reviewPayload({ product_public_id: product.public_id }));

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.public_id).toMatch(/^rev_/);
        expect(response.body.data.product_public_id).toBe(product.public_id);
        expect(response.body.data).not.toHaveProperty("is_approved");
        expect(response.body.data).not.toHaveProperty("id");
      });

      it("creates a review with images (201)", async () => {
        const { cookie, csrf } = await registerUser(app);
        const product = await createProduct();

        const response = await request(app)
          .post(REVIEWS_BASE_URL)
          .set(csrfHeaders(cookie!, csrf!))
          .send(
            reviewPayload({
              product_public_id: product.public_id,
              images: [
                { image_url: "https://example.com/reviews/a.jpg", alt_text: "a" },
              ],
            }),
          );

        expect(response.status).toBe(201);
        expect(response.body.data.images).toHaveLength(1);
        expect(response.body.data.images[0].display_order).toBe(1);
      });

      it("returns 401 without a session", async () => {
        const product = await createProduct();

        const response = await request(app)
          .post(REVIEWS_BASE_URL)
          .send(reviewPayload({ product_public_id: product.public_id }));

        expect(response.status).toBe(401);
      });

      it("returns 409 for a duplicate review", async () => {
        const { cookie, payload, csrf } = await registerUser(app);
        const product = await createProduct();
        const storedUser = await userByEmail(payload.email);
        await createReview({ users_id: storedUser!.id, products_id: product.id });

        const response = await request(app)
          .post(REVIEWS_BASE_URL)
          .set(csrfHeaders(cookie!, csrf!))
          .send(reviewPayload({ product_public_id: product.public_id }));

        expect(response.status).toBe(409);
        expect(response.body.success).toBe(false);
      });

      it("returns 404 for a soft-deleted product", async () => {
        const { cookie, csrf } = await registerUser(app);
        const product = await createProduct({ deleted_at: new Date() });

        const response = await request(app)
          .post(REVIEWS_BASE_URL)
          .set(csrfHeaders(cookie!, csrf!))
          .send(reviewPayload({ product_public_id: product.public_id }));

        expect(response.status).toBe(404);
      });

      it("rejects a rating out of range (400)", async () => {
        const { cookie, csrf } = await registerUser(app);
        const product = await createProduct();

        const response = await request(app)
          .post(REVIEWS_BASE_URL)
          .set(csrfHeaders(cookie!, csrf!))
          .send(reviewPayload({ product_public_id: product.public_id, rating: 6 }));

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe("PATCH /api/v1/reviews/:review_public_id", () => {
      it("updates the user's own review (200)", async () => {
        const { cookie, payload, csrf } = await registerUser(app);
        const product = await createProduct();
        const storedUser = await userByEmail(payload.email);
        const review = await createReview({
          users_id: storedUser!.id,
          products_id: product.id,
          rating: 5,
        });

        const response = await request(app)
          .patch(`${REVIEWS_BASE_URL}/${review.public_id}`)
          .set(csrfHeaders(cookie!, csrf!))
          .send({ rating: 4, comment: "Updated" });

        expect(response.status).toBe(200);
        expect(response.body.data.rating).toBe(4);
        expect(response.body.data.comment).toBe("Updated");
      });

      it("returns 404 for another user's review", async () => {
        const { cookie, csrf } = await registerUser(app);
        const owner = await registerUser(app);
        const product = await createProduct();
        const storedOwner = await userByEmail(owner.payload.email);
        const review = await createReview({
          users_id: storedOwner!.id,
          products_id: product.id,
        });

        const response = await request(app)
          .patch(`${REVIEWS_BASE_URL}/${review.public_id}`)
          .set(csrfHeaders(cookie!, csrf!))
          .send({ rating: 3 });

        expect(response.status).toBe(404);
      });

      it("rejects an empty body (400)", async () => {
        const { cookie, payload, csrf } = await registerUser(app);
        const product = await createProduct();
        const storedUser = await userByEmail(payload.email);
        const review = await createReview({
          users_id: storedUser!.id,
          products_id: product.id,
        });

        const response = await request(app)
          .patch(`${REVIEWS_BASE_URL}/${review.public_id}`)
          .set(csrfHeaders(cookie!, csrf!))
          .send({});

        expect(response.status).toBe(400);
      });
    });

    describe("DELETE /api/v1/reviews/:review_public_id", () => {
      it("soft-deletes the user's own review (204)", async () => {
        const { cookie, payload, csrf } = await registerUser(app);
        const product = await createProduct();
        const storedUser = await userByEmail(payload.email);
        const review = await createReview({
          users_id: storedUser!.id,
          products_id: product.id,
        });

        const response = await request(app)
          .delete(`${REVIEWS_BASE_URL}/${review.public_id}`)
          .set(csrfHeaders(cookie!, csrf!))

        expect(response.status).toBe(204);

        const getResponse = await request(app).get(
          `${REVIEWS_BASE_URL}/${review.public_id}`,
        );
        expect(getResponse.status).toBe(404);
      });

      it("returns 404 for another user's review", async () => {
        const { cookie, csrf } = await registerUser(app);
        const owner = await registerUser(app);
        const product = await createProduct();
        const storedOwner = await userByEmail(owner.payload.email);
        const review = await createReview({
          users_id: storedOwner!.id,
          products_id: product.id,
        });

        const response = await request(app)
          .delete(`${REVIEWS_BASE_URL}/${review.public_id}`)
          .set(csrfHeaders(cookie!, csrf!))

        expect(response.status).toBe(404);
      });
    });

    describe("GET /api/v1/users/me/reviews", () => {
      it("returns the user's own reviews including unapproved (200)", async () => {
        const { cookie, payload, csrf } = await registerUser(app);
        const product = await createProduct();
        const storedUser = await userByEmail(payload.email);
        const approved = await createReview({
          users_id: storedUser!.id,
          products_id: product.id,
        });
        const unapproved = await createReview({
          users_id: storedUser!.id,
          products_id: product.id,
          rating: 2,
          is_approved: false,
        });

        const response = await request(app)
          .get(OWN_REVIEWS_BASE_URL)
          .set("Cookie", cookie!);

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(
          response.body.data.reviews.map((r: { public_id: string }) => r.public_id),
        ).toEqual(expect.arrayContaining([approved.public_id, unapproved.public_id]));
        expect(response.body.data.reviews[0]).toHaveProperty("is_approved");
        expect(response.body.pagination.total).toBe(2);
      });

      it("returns 401 without a session", async () => {
        const response = await request(app).get(OWN_REVIEWS_BASE_URL);

        expect(response.status).toBe(401);
      });
    });
  });

  describe("admin review management", () => {
    async function customerReview() {
      const { payload } = await registerUser(app);
      const product = await createProduct();
      const storedUser = await userByEmail(payload.email);
      const review = await createReview({
        users_id: storedUser!.id,
        products_id: product.id,
      });
      return review;
    }

    describe("authentication and authorization", () => {
      it("returns 401 without a session", async () => {
        const response = await request(app).get(ADMIN_REVIEWS_BASE_URL);

        expect(response.status).toBe(401);
      });

      it("returns 403 for a non-admin session", async () => {
        const { cookie, csrf } = await registerUser(app);

        const response = await request(app)
          .get(ADMIN_REVIEWS_BASE_URL)
          .set("Cookie", cookie!);

        expect(response.status).toBe(403);
      });
    });

    describe("GET /api/v1/admin/reviews", () => {
      it("lists reviews with admin projections (200)", async () => {
        const { cookie, csrf } = await createAdminUser(app);
        const review = await customerReview();

        const response = await request(app)
          .get(ADMIN_REVIEWS_BASE_URL)
          .set("Cookie", cookie!);

        expect(response.status).toBe(200);
        expect(response.body.data.reviews.map((r: { public_id: string }) => r.public_id)).toContain(
          review.public_id,
        );
        expect(response.body.data.reviews[0]).toHaveProperty("customer_email");
        expect(response.body.data.reviews[0]).toHaveProperty("is_approved");
        expect(response.body.data.reviews[0]).not.toHaveProperty("deleted_at");
      });

      it("includes soft-deleted reviews when include_deleted=true (200)", async () => {
        const { cookie, csrf } = await createAdminUser(app);
        const { payload } = await registerUser(app);
        const product = await createProduct();
        const storedUser = await userByEmail(payload.email);
        const deleted = await createReview({
          users_id: storedUser!.id,
          products_id: product.id,
          deleted_at: new Date(),
        });

        const response = await request(app)
          .get(`${ADMIN_REVIEWS_BASE_URL}?include_deleted=true`)
          .set("Cookie", cookie!);

        expect(response.status).toBe(200);
        expect(response.body.data.reviews.map((r: { public_id: string }) => r.public_id)).toContain(
          deleted.public_id,
        );
      });

      it("filters by is_approved=false (200)", async () => {
        const { cookie, csrf } = await createAdminUser(app);
        const { payload } = await registerUser(app);
        const product = await createProduct();
        const storedUser = await userByEmail(payload.email);
        await createReview({ users_id: storedUser!.id, products_id: product.id });
        const unapproved = await createReview({
          users_id: storedUser!.id,
          products_id: product.id,
          rating: 1,
          is_approved: false,
        });

        const response = await request(app)
          .get(`${ADMIN_REVIEWS_BASE_URL}?is_approved=false`)
          .set("Cookie", cookie!);

        expect(response.status).toBe(200);
        expect(response.body.data.reviews.map((r: { public_id: string }) => r.public_id)).toEqual([
          unapproved.public_id,
        ]);
      });

      it("rejects an invalid is_approved value (400)", async () => {
        const { cookie, csrf } = await createAdminUser(app);

        const response = await request(app)
          .get(`${ADMIN_REVIEWS_BASE_URL}?is_approved=yes`)
          .set("Cookie", cookie!);

        expect(response.status).toBe(400);
      });
    });

    describe("GET /api/v1/admin/reviews/:review_public_id", () => {
      it("returns a review in any state with images (200)", async () => {
        const { cookie, csrf } = await createAdminUser(app);
        const review = await customerReview();
        await createReviewImage({ reviews_id: review.id, display_order: 1 });

        const response = await request(app)
          .get(`${ADMIN_REVIEWS_BASE_URL}/${review.public_id}`)
          .set("Cookie", cookie!);

        expect(response.status).toBe(200);
        expect(response.body.data.public_id).toBe(review.public_id);
        expect(response.body.data.images).toHaveLength(1);
        expect(response.body.data).toHaveProperty("customer_email");
      });

      it("returns 404 for an unknown review", async () => {
        const { cookie, csrf } = await createAdminUser(app);

        const response = await request(app)
          .get(`${ADMIN_REVIEWS_BASE_URL}/rev_${nanoid(10)}`)
          .set("Cookie", cookie!);

        expect(response.status).toBe(404);
      });
    });

    describe("PATCH /api/v1/admin/reviews/:review_public_id", () => {
      it("moderates a review (200)", async () => {
        const { cookie, csrf } = await createAdminUser(app);
        const review = await customerReview();

        const response = await request(app)
          .patch(`${ADMIN_REVIEWS_BASE_URL}/${review.public_id}`)
          .set(csrfHeaders(cookie!, csrf!))
          .send({ is_approved: false, comment: "Edited by support" });

        expect(response.status).toBe(200);
        expect(response.body.data.is_approved).toBe(false);
        expect(response.body.data.comment).toBe("Edited by support");
      });

      it("rejects approving a soft-deleted review (400)", async () => {
        const { cookie, csrf } = await createAdminUser(app);
        const { payload } = await registerUser(app);
        const product = await createProduct();
        const storedUser = await userByEmail(payload.email);
        const deleted = await createReview({
          users_id: storedUser!.id,
          products_id: product.id,
          deleted_at: new Date(),
        });

        const response = await request(app)
          .patch(`${ADMIN_REVIEWS_BASE_URL}/${deleted.public_id}`)
          .set(csrfHeaders(cookie!, csrf!))
          .send({ is_approved: true });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      it("rejects an empty body (400)", async () => {
        const { cookie, csrf } = await createAdminUser(app);
        const review = await customerReview();

        const response = await request(app)
          .patch(`${ADMIN_REVIEWS_BASE_URL}/${review.public_id}`)
          .set(csrfHeaders(cookie!, csrf!))
          .send({});

        expect(response.status).toBe(400);
      });
    });

    describe("DELETE /api/v1/admin/reviews/:review_public_id", () => {
      it("soft-deletes a review (204)", async () => {
        const { cookie, csrf } = await createAdminUser(app);
        const review = await customerReview();

        const response = await request(app)
          .delete(`${ADMIN_REVIEWS_BASE_URL}/${review.public_id}`)
          .set(csrfHeaders(cookie!, csrf!))

        expect(response.status).toBe(204);

        const getResponse = await request(app)
          .get(`${ADMIN_REVIEWS_BASE_URL}/${review.public_id}`)
          .set("Cookie", cookie!);
        expect(getResponse.status).toBe(200);
        expect(getResponse.body.data.deleted_at).not.toBeNull();
      });

      it("returns 404 for an unknown review", async () => {
        const { cookie, csrf } = await createAdminUser(app);

        const response = await request(app)
          .delete(`${ADMIN_REVIEWS_BASE_URL}/rev_${nanoid(10)}`)
          .set(csrfHeaders(cookie!, csrf!))

        expect(response.status).toBe(404);
      });
    });
  });
});
