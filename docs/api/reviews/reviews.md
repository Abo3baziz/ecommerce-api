# Reviews API

> Registered under the **Reviews** section of `docs/API_DESIGN.md`.

## Overview

The Reviews API lets authenticated customers write, update, and delete reviews for products, lets the public read approved reviews per product, and gives administrators moderation control over review content.

Reviews map 1:1 to the `reviews` table; optional images map to `review_images`. A review belongs to exactly one user and one product. Only non-deleted, approved reviews of non-deleted products are visible to the public.

---

## Resource Model

### Review Object (customer projection)

| Field | Type | Notes |
|-------|------|-------|
| public_id | string | `rev_...` prefix |
| rating | integer | 1-5 (DB check `ck_reviews_rating_range`) |
| title | string \| null | max 255 |
| comment | string \| null | free text |
| customer_name | string | `first_name last_name` of the reviewer |
| product_public_id | string | `prd_...` |
| product_name | string | live product name |
| product_slug | string | live product slug |
| images | Review Image Object[] | ordered by `display_order`, then `created_at` |
| created_at | datetime | |
| updated_at | datetime | |

Customer projections never expose `is_approved` or `deleted_at`. Customer-visible reviews always have `is_approved = true`.

### Review Object (admin projection)

Adds to the customer projection:

| Field | Type | Notes |
|-------|------|-------|
| is_approved | boolean | moderation state |
| customer_public_id | string | `usr_...` |
| customer_email | string | reviewer email |
| deleted_at | datetime \| null | soft-delete marker |

### Review Image Object

| Field | Type | Notes |
|-------|------|-------|
| public_id | string | `rvimg_...` |
| image_url | string | absolute http/https URL |
| alt_text | string \| null | max 255 |
| display_order | integer \| null | 1..n within the review |

### Rating Summary Object (product reviews list only)

| Field | Type | Notes |
|-------|------|-------|
| average_rating | number \| null | mean rating of visible reviews, rounded to 2 dp (e.g. `4.5`); `null` when there are no visible reviews |
| total_count | integer | count of visible reviews, ignoring `page`/`limit` |

> The summary is computed over the same visibility filter as the list rows but ignores pagination, so `total_count` equals `pagination.total`.

---

## Endpoints

| Method | URI | Auth | Description |
|--------|-----|------|-------------|
| GET | `/api/v1/products/{product_public_id}/reviews` | Public | List approved reviews for a product + rating summary |
| GET | `/api/v1/reviews/{review_public_id}` | Public | Get one approved review |
| POST | `/api/v1/reviews` | Authenticated | Create a review |
| PATCH | `/api/v1/reviews/{review_public_id}` | Authenticated | Update own review |
| DELETE | `/api/v1/reviews/{review_public_id}` | Authenticated | Soft-delete own review |
| GET | `/api/v1/users/me/reviews` | Authenticated | List own reviews |
| GET | `/api/v1/admin/reviews` | Admin | List all reviews (moderation queue) |
| GET | `/api/v1/admin/reviews/{review_public_id}` | Admin | Get one review (any state) |
| PATCH | `/api/v1/admin/reviews/{review_public_id}` | Admin | Moderate (approve/unapprove, edit content) |
| DELETE | `/api/v1/admin/reviews/{review_public_id}` | Admin | Soft-delete a review |

---

## Customer Endpoints

# List Product Reviews

## Overview

Returns the approved, non-deleted reviews for a product (paginated), plus a rating summary computed over all visible reviews. Public - no session required.

---

## Endpoint

```http
GET /api/v1/products/{product_public_id}/reviews
```

---

## Authentication

| Requirement | Value |
|-------------|-------|
| Authentication | Not Required |

---

## Authorization

None - public catalog data.

---

## Request Headers

| Header | Required | Description |
|--------|----------|-------------|

> None.

---

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| product_public_id | string | Yes | `prd_...` public ID of the product |

---

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | integer | No | 1-based page, default 1, min 1 |
| limit | integer | No | default 10, 1-100 |
| rating | integer | No | exact rating filter, 1-5 |
| sort | string | No | `created_at` or `rating`; default `-created_at` (`-` = descending) |

---

## Request Body

> None.

---

## Successful Response

**200 OK**

### Response Body

```json
{
  "success": true,
  "data": {
    "summary": {
      "average_rating": 4.5,
      "total_count": 12
    },
    "reviews": [
      {
        "public_id": "rev_abc123",
        "rating": 5,
        "title": "Excellent quality",
        "comment": "The fabric feels premium.",
        "customer_name": "Ahmed Aziz",
        "product_public_id": "prd_xyz789",
        "product_name": "Cotton T-Shirt",
        "product_slug": "cotton-t-shirt",
        "images": [
          {
            "public_id": "rvimg_abc123",
            "image_url": "https://ik.imagekit.io/ecommerceImages/review-1.jpg",
            "alt_text": "Shirt on hanger",
            "display_order": 1
          }
        ],
        "created_at": "2026-07-01T10:00:00.000Z",
        "updated_at": "2026-07-01T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 12,
      "has_more": true
    }
  }
}
```

### Response Headers

> None.

---

## Processing Flow

1. Resolve the product by `product_public_id`; if missing or soft-deleted -> 404 (no existence leak between missing and deleted).
2. Query reviews where `products_id` matches, `deleted_at IS NULL`, `is_approved = true`, plus the optional `rating` filter.
3. Order by the requested sort (`created_at`/`rating`, default `created_at DESC`) with the internal `id` as the deterministic tiebreaker.
4. Apply pagination (`page`/`limit`).
5. Compute the summary over all visible reviews (ignoring pagination): `average_rating = round2(avg(rating))`, `total_count = count`.
6. Embed the reviewer name, live product context, and ordered images.

---

## Business Rules

- Only `is_approved = true` AND `deleted_at IS NULL` reviews of non-deleted products are returned.
- `average_rating` is rounded to 2 decimal places; `total_count` ignores `page`/`limit`.
- Ties in sorting are broken by the internal `id` for stable pagination.
- Empty result sets return `reviews: []`, `summary.total_count: 0`, `summary.average_rating: null`.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 | Invalid query parameters (bad `rating`, `sort`, `page`, `limit`) |
| 404 | Product not found or soft-deleted |

---

## Security Considerations

- Public endpoint - never returns `is_approved`, `deleted_at`, reviewer email, or internal IDs.
- Reviewer identity is exposed as `customer_name` (full first + last name), matching the orders admin projection convention; masking to first-name + initial is a possible future privacy hardening.

---

## Notes

- Mounted as a nested customer route under the products router (mirrors `GET /categories/{id}/products`).
- The `rating` filter is an exact match; multi-rating ranges are out of scope for v1.

---

# Get Review

## Overview

Returns a single approved, non-deleted review. Public - no session required.

---

## Endpoint

```http
GET /api/v1/reviews/{review_public_id}
```

---

## Authentication

| Requirement | Value |
|-------------|-------|
| Authentication | Not Required |

---

## Authorization

None - public catalog data.

---

## Request Headers

| Header | Required | Description |
|--------|----------|-------------|

> None.

---

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| review_public_id | string | Yes | `rev_...` public ID of the review |

---

## Query Parameters

> None.

---

## Request Body

> None.

---

## Successful Response

**200 OK**

### Response Body

```json
{
  "success": true,
  "data": {
    "public_id": "rev_abc123",
    "rating": 4,
    "title": "Good value",
    "comment": "Solid product for the price.",
    "customer_name": "Ahmed Aziz",
    "product_public_id": "prd_xyz789",
    "product_name": "Cotton T-Shirt",
    "product_slug": "cotton-t-shirt",
    "images": [],
    "created_at": "2026-07-02T09:30:00.000Z",
    "updated_at": "2026-07-02T09:30:00.000Z"
  }
}
```

### Response Headers

> None.

---

## Processing Flow

1. Look up the review by `public_id` where `deleted_at IS NULL` and `is_approved = true` and the parent product is non-deleted.
2. If not found -> 404.
3. Return the customer projection with images ordered by `display_order`, then `created_at`.

---

## Business Rules

- Unapproved, soft-deleted, or product-deleted reviews are indistinguishable from missing reviews (single 404).

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 | Invalid `review_public_id` format |
| 404 | Review not found, unapproved, or deleted |

---

## Security Considerations

- Public endpoint - never returns moderation state or reviewer email.

---

## Notes

- Intended for deep links and single-review embeds on product pages.

---

# Create Review

## Overview

Creates a review for a product on behalf of the authenticated user. One review per user per product.

---

## Endpoint

```http
POST /api/v1/reviews
```

---

## Authentication

| Requirement | Value |
|-------------|-------|
| Authentication | Required |

---

## Authorization

Any authenticated role. Reviews are always scoped to the session user's internal ID; users cannot create reviews on behalf of others.

---

## Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| Cookie (`session`) | Yes | Session cookie from login/register |

---

## Path Parameters

> None.

---

## Query Parameters

> None.

---

## Request Body

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| product_public_id | string | Yes | `prd_...` format |
| rating | integer | Yes | 1-5 |
| title | string | No | max 255 |
| comment | string | No | max 5000 |
| images | array | No | max 5 items |

Each image item:

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| image_url | string | Yes | absolute http/https URL |
| alt_text | string | No | max 255 |

### Example

```json
{
  "product_public_id": "prd_xyz789",
  "rating": 5,
  "title": "Excellent quality",
  "comment": "The fabric feels premium.",
  "images": [
    {
      "image_url": "https://ik.imagekit.io/ecommerceImages/review-1.jpg",
      "alt_text": "Shirt on hanger"
    }
  ]
}
```

---

## Successful Response

**201 Created**

### Response Body

```json
{
  "success": true,
  "data": {
    "public_id": "rev_abc123",
    "rating": 5,
    "title": "Excellent quality",
    "comment": "The fabric feels premium.",
    "customer_name": "Ahmed Aziz",
    "product_public_id": "prd_xyz789",
    "product_name": "Cotton T-Shirt",
    "product_slug": "cotton-t-shirt",
    "images": [
      {
        "public_id": "rvimg_abc123",
        "image_url": "https://ik.imagekit.io/ecommerceImages/review-1.jpg",
        "alt_text": "Shirt on hanger",
        "display_order": 1
      }
    ],
    "created_at": "2026-07-03T08:00:00.000Z",
    "updated_at": "2026-07-03T08:00:00.000Z"
  }
}
```

### Response Headers

> None.

---

## Processing Flow

1. Resolve the product by `product_public_id`; missing or soft-deleted -> 404.
2. Check for an existing non-deleted review by the same user for the same product; found -> 409.
3. (Optional, disabled in v1) If purchase verification is enabled, verify the user has a non-cancelled order containing a variant of this product; otherwise -> 409.
4. Create the `reviews` row (`is_approved` defaults to `true`, `created_at`/`updated_at` = now) in one `prisma.$transaction`.
5. Create `review_images` rows in the same transaction with `display_order` = 1..n by array index.
6. Return the customer projection.

---

## Business Rules

- One non-deleted review per user per product; a second review -> 409. The DB-level hardening (a future `@@unique([users_id, products_id])` index) is documented as a hardening step, not applied.
- `rating` must be 1-5 (mirrors the DB check `ck_reviews_rating_range`).
- `is_approved` is `true` by default: v1 reviews are auto-approved.
- Purchase verification is gated by the shared constant `REVIEWS_REQUIRE_PURCHASE` (default `false`). When enabled, the service verifies via `order_items -> product_variants.products_id` with order status in `CONFIRMED|PROCESSING|SHIPPED|DELIVERED` (cancelled/refunded orders do not qualify). This maps the "Only verified customers may review purchased products if this feature is enabled" requirement.
- `images` may be omitted or empty; when provided, `display_order` is assigned 1..n by array index.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 | Invalid body (rating out of range, bad `image_url`, too many images, missing `product_public_id`) |
| 401 | Not authenticated |
| 404 | Product not found or soft-deleted |
| 409 | User already reviewed this product / (if enabled) no qualifying purchase |

---

## Security Considerations

- Body `product_public_id` is owner-agnostic (any user can review any visible product), but the review is always attributed to the session user - the `users_id` comes from `req.user`, never from the body.
- `image_url` validation reuses the shared image-URL field rule (absolute http/https); the ImageKit signed-upload flow used by product images is not re-exposed here in v1.

---

## Notes

- `REVIEWS_REQUIRE_PURCHASE` is added to `src/shared/constants/index.ts` next to the shipping constants.

---

---

# Update Review

## Overview

Updates the authenticated user's own review. Partial update - only provided fields change.

---

## Endpoint

```http
PATCH /api/v1/reviews/{review_public_id}
```

---

## Authentication

| Requirement | Value |
|-------------|-------|
| Authentication | Required |

---

## Authorization

The review must belong to the session user; another user's review (or a missing one) -> 404 (no existence leak).

---

## Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| Cookie (`session`) | Yes | Session cookie |

---

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| review_public_id | string | Yes | `rev_...` public ID of the review |

---

## Query Parameters

> None.

---

## Request Body

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| rating | integer | No | 1-5 |
| title | string \| null | No | max 255; `null` clears |
| comment | string \| null | No | max 5000; `null` clears |
| images | array | No | max 5 items; when provided it REPLACES the whole image set |

### Example

```json
{
  "rating": 4,
  "comment": "Updated after a week of use."
}
```

---

## Successful Response

**200 OK**

### Response Body

Customer projection of the updated review (same shape as **Create Review**).

### Response Headers

> None.

---

## Processing Flow

1. Look up the review by `public_id` where `users_id` = session user and `deleted_at IS NULL`; not found -> 404.
2. Build the update from the provided fields; at least one field must be present (400 on empty body).
3. If `images` is provided: delete all existing `review_images` rows for the review and create the new set with `display_order` 1..n - all inside one `prisma.$transaction` with the review update.
4. Refresh `updated_at`.
5. Return the customer projection.

---

## Business Rules

- Partial update semantics: omitted fields are untouched; explicit `null` clears `title`/`comment`.
- `images` is replace-all: sending an array replaces the entire set; omitting it leaves images untouched. There is no incremental image editing in v1.
- Updating a review does not reset `is_approved` (a re-edited review keeps its moderation state).
- Empty body or only unknown fields -> 400.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 | Empty body, invalid fields, too many images |
| 401 | Not authenticated |
| 404 | Review not found, soft-deleted, or not owned by the session user |

---

## Security Considerations

- Ownership check uses the session user's internal ID; foreign reviews are indistinguishable from missing ones (404).

---

## Notes

- Deleting an image from the library is the client's responsibility (same convention as product images: the API only stores URLs).

---

# Delete Review

## Overview

Soft-deletes the authenticated user's own review and hard-deletes its images in one transaction.

---

## Endpoint

```http
DELETE /api/v1/reviews/{review_public_id}
```

---

## Authentication

| Requirement | Value |
|-------------|-------|
| Authentication | Required |

---

## Authorization

The review must belong to the session user; another user's review (or a missing one) -> 404.

---

## Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| Cookie (`session`) | Yes | Session cookie |

---

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| review_public_id | string | Yes | `rev_...` public ID of the review |

---

## Query Parameters

> None.

---

## Request Body

> None.

---

## Successful Response

**204 No Content**

### Response Body

> None.

### Response Headers

> None.

---

## Processing Flow

1. Look up the review by `public_id` where `users_id` = session user and `deleted_at IS NULL`; not found -> 404.
2. In one `prisma.$transaction`: set `deleted_at` = now (refresh `updated_at`) and hard-delete all `review_images` rows for the review.
3. Return 204.

---

## Business Rules

- Soft delete preserves the row for audit/history; the review disappears from all customer-visible lists and the product summary.
- `review_images` has no `deleted_at` column, so images are hard-deleted with the review (keeps the media rows clean).
- Deleting an already-deleted review -> 404.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 401 | Not authenticated |
| 404 | Review not found, soft-deleted, or not owned by the session user |

---

## Security Considerations

- Same ownership-404 pattern as **Update Review**.

---

## Notes

- The ImageKit files themselves are not deleted (matches the product-image convention: only DB rows are removed).

---

# List Own Reviews

## Overview

Returns the authenticated user's own reviews (paginated), including unapproved ones - the customer-facing management view.

---

## Endpoint

```http
GET /api/v1/users/me/reviews
```

---

## Authentication

| Requirement | Value |
|-------------|-------|
| Authentication | Required |

---

## Authorization

Scoped to the session user; only their own reviews are ever returned.

---

## Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| Cookie (`session`) | Yes | Session cookie |

---

## Path Parameters

> None.

---

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | integer | No | 1-based page, default 1 |
| limit | integer | No | default 10, 1-100 |
| sort | string | No | `created_at` or `rating`; default `-created_at` |

---

## Request Body

> None.

---

## Successful Response

**200 OK**

### Response Body

```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "public_id": "rev_abc123",
        "rating": 5,
        "title": "Excellent quality",
        "comment": "The fabric feels premium.",
        "customer_name": "Ahmed Aziz",
        "product_public_id": "prd_xyz789",
        "product_name": "Cotton T-Shirt",
        "product_slug": "cotton-t-shirt",
        "is_approved": true,
        "images": [],
        "created_at": "2026-07-01T10:00:00.000Z",
        "updated_at": "2026-07-01T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "has_more": false
    }
  }
}
```

### Response Headers

> None.

---

## Processing Flow

1. Query reviews where `users_id` = session user and `deleted_at IS NULL`.
2. Order by the requested sort with `id` as tiebreaker; paginate.
3. Return rows with the customer projection plus `is_approved` (so the user sees moderation state).

---

## Business Rules

- Own review list shows `is_approved`; soft-deleted reviews are excluded.
- No rating summary on this endpoint.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 | Invalid query parameters |
| 401 | Not authenticated |

---

## Security Considerations

- Only the session user's own reviews; no cross-user data access.

---

## Notes

- Mounted via the users router (`/users/me/reviews`), mirroring the addresses precedent.
- The customer projection plus `is_approved` is the only projection that includes moderation state on the customer side (needed so users can see pending/unapproved reviews).

---

## Admin Endpoints

# List Reviews (Admin)

## Overview

Returns all reviews across all products (paginated) for moderation - the review queue. Includes unapproved and (optionally) soft-deleted reviews.

---

## Endpoint

```http
GET /api/v1/admin/reviews
```

---

## Authentication

| Requirement | Value |
|-------------|-------|
| Authentication | Required |

---

## Authorization

`ADMIN` or `SUPER_ADMIN` role (shared `authorization` middleware).

---

## Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| Cookie (`session`) | Yes | Session cookie of an admin/super-admin |

---

## Path Parameters

> None.

---

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | integer | No | 1-based page, default 1 |
| limit | integer | No | default 10, 1-100 |
| search | string | No | case-insensitive substring on product name, review title, comment, customer email, or customer name |
| rating | integer | No | exact rating filter, 1-5 |
| is_approved | string | No | `true`, `false`, or `all` (default `all`) |
| include_deleted | boolean | No | default `false`; include soft-deleted reviews |
| sort | string | No | `created_at` or `rating`; default `-created_at` |

---

## Request Body

> None.

---

## Successful Response

**200 OK**

### Response Body

```json
{
  "success": true,
  "data": {
    "reviews": [
      {
        "public_id": "rev_abc123",
        "rating": 1,
        "title": "Bad fit",
        "comment": "Runs small.",
        "customer_name": "Ahmed Aziz",
        "customer_email": "ahmed@example.com",
        "product_public_id": "prd_xyz789",
        "product_name": "Cotton T-Shirt",
        "product_slug": "cotton-t-shirt",
        "is_approved": false,
        "images": [],
        "created_at": "2026-07-04T14:00:00.000Z",
        "updated_at": "2026-07-04T14:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 3,
      "has_more": false
    }
  }
}
```

### Response Headers

> None.

---

## Processing Flow

1. Build the filter: `rating`, `is_approved` (unless `all`), `deleted_at IS NULL` (unless `include_deleted`), and the case-insensitive `search` across product name / title / comment / customer email / customer name.
2. Order by the requested sort with `id` as tiebreaker; paginate.
3. Return admin projections (includes `is_approved`, `customer_email`; omits `deleted_at` unless `include_deleted` is used).

---

## Business Rules

- `search` matches substrings case-insensitively (ILIKE); LIKE wildcards in input are escaped (treated literally).
- Default view excludes soft-deleted reviews; `include_deleted=true` includes them (projection then carries `deleted_at`).
- The list intentionally does not embed the full image set for every row; images are returned on the detail endpoint.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 | Invalid query parameters (bad `is_approved`, `rating`, `sort`, etc.) |
| 401 | Not authenticated |
| 403 | Authenticated but not admin/super-admin |

---

## Security Considerations

- Admin-only surface; customer projections never include `customer_email`.

---

## Notes

- The customer-name search requires the same derived `first_name || ' ' || last_name` expression approach used by the admin orders list (schema-qualified raw SQL).

---

# Get Review (Admin)

## Overview

Returns one review in any state (unapproved or soft-deleted included), with images and customer summary.

---

## Endpoint

```http
GET /api/v1/admin/reviews/{review_public_id}
```

---

## Authentication

| Requirement | Value |
|-------------|-------|
| Authentication | Required |

---

## Authorization

`ADMIN` or `SUPER_ADMIN`.

---

## Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| Cookie (`session`) | Yes | Session cookie of an admin/super-admin |

---

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| review_public_id | string | Yes | `rev_...` public ID of the review |

---

## Query Parameters

> None.

---

## Request Body

> None.

---

## Successful Response

**200 OK**

### Response Body

```json
{
  "success": true,
  "data": {
    "public_id": "rev_abc123",
    "rating": 1,
    "title": "Bad fit",
    "comment": "Runs small.",
    "customer_name": "Ahmed Aziz",
    "customer_public_id": "usr_123",
    "customer_email": "ahmed@example.com",
    "product_public_id": "prd_xyz789",
    "product_name": "Cotton T-Shirt",
    "product_slug": "cotton-t-shirt",
    "is_approved": false,
    "images": [],
    "created_at": "2026-07-04T14:00:00.000Z",
    "updated_at": "2026-07-04T14:00:00.000Z"
  }
}
```

### Response Headers

> None.

---

## Processing Flow

1. Look up the review by `public_id` (any state, including deleted).
2. Not found -> 404.
3. Return the admin projection with images ordered by `display_order`, then `created_at`.

---

## Business Rules

- No visibility filter: deleted and unapproved reviews are returned with `deleted_at` / `is_approved` surfaced.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 | Invalid `review_public_id` format |
| 401 | Not authenticated |
| 403 | Not admin/super-admin |
| 404 | Review not found |

---

## Security Considerations

- Admin-only surface.

---

## Notes

> None.

---

# Moderate Review (Admin)

## Overview

Moderates a review: approve/unapprove and/or edit its content. Partial update.

---

## Endpoint

```http
PATCH /api/v1/admin/reviews/{review_public_id}
```

---

## Authentication

| Requirement | Value |
|-------------|-------|
| Authentication | Required |

---

## Authorization

`ADMIN` or `SUPER_ADMIN`.

---

## Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| Cookie (`session`) | Yes | Session cookie of an admin/super-admin |

---

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| review_public_id | string | Yes | `rev_...` public ID of the review |

---

## Query Parameters

> None.

---

## Request Body

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| is_approved | boolean | No | toggle moderation state |
| rating | integer | No | 1-5 |
| title | string \| null | No | max 255; `null` clears |
| comment | string \| null | No | max 5000; `null` clears |

### Example

```json
{
  "is_approved": true,
  "comment": "Edited by support after user clarification."
}
```

---

## Successful Response

**200 OK**

### Response Body

Admin projection of the moderated review (same shape as **Get Review (Admin)**).

### Response Headers

> None.

---

## Processing Flow

1. Look up the review by `public_id` (any state); not found -> 404.
2. Build the update from provided fields; at least one field must be present (400 on empty body).
3. Update the row and refresh `updated_at`; audit-log via the structured logger (`actorId`, `reviewPublicId`, changed fields).
4. Return the admin projection.

---

## Business Rules

- Approving a soft-deleted review is rejected (400) - deleted reviews are terminal in v1.
- `images` cannot be changed through this endpoint (customer-side PATCH owns images).
- The audit log records which fields changed (`is_approved`, `rating`, `title`, `comment`).

---

## Error Responses

| Status | Reason |
|--------|--------|
| 400 | Empty body, invalid fields, or approving a soft-deleted review |
| 401 | Not authenticated |
| 403 | Not admin/super-admin |
| 404 | Review not found |

---

## Security Considerations

- Admin-only surface; content edits are audit-logged with the actor id.

---

## Notes

> None.

---

# Delete Review (Admin)

## Overview

Soft-deletes any review and hard-deletes its images in one transaction.

---

## Endpoint

```http
DELETE /api/v1/admin/reviews/{review_public_id}
```

---

## Authentication

| Requirement | Value |
|-------------|-------|
| Authentication | Required |

---

## Authorization

`ADMIN` or `SUPER_ADMIN`.

---

## Request Headers

| Header | Required | Description |
|--------|----------|-------------|
| Cookie (`session`) | Yes | Session cookie of an admin/super-admin |

---

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| review_public_id | string | Yes | `rev_...` public ID of the review |

---

## Query Parameters

> None.

---

## Request Body

> None.

---

## Successful Response

**204 No Content**

### Response Body

> None.

### Response Headers

> None.

---

## Processing Flow

1. Look up the review by `public_id` (any state); not found -> 404.
2. In one `prisma.$transaction`: set `deleted_at` = now and hard-delete all `review_images` rows.
3. Audit-log via the structured logger (`actorId`, `reviewPublicId`).
4. Return 204.

---

## Business Rules

- Same soft-delete + hard-delete-images semantics as the customer delete; deleting an already-deleted review -> 404.

---

## Error Responses

| Status | Reason |
|--------|--------|
| 401 | Not authenticated |
| 403 | Not admin/super-admin |
| 404 | Review not found |

---

## Security Considerations

- Admin-only surface; audit-logged.

---

## Notes

> None.

---

## Design Decisions

- **One review per user per product** (service-enforced, 409 on duplicates): matches ecommerce conventions. The DB hardening `@@unique([users_id, products_id])` is documented as future work since `reviews` is a check-constrained table.
- **Customer list is product-scoped** (`GET /products/{product_public_id}/reviews`), mirroring the categories `GET /categories/{id}/products` precedent, instead of a flat `GET /reviews?product_id=`.
- **Public read, authenticated write**: reviews are public catalog content; write/update/delete are authenticated, own-review only (404 for foreign reviews, no existence leak).
- **`is_approved` defaults to `true`** (schema default): v1 reviews are auto-approved; the admin queue (`is_approved=false` filter) supports later moderation-first flows without a schema change.
- **Purchase verification is a config flag**: `REVIEWS_REQUIRE_PURCHASE` shared constant, default `false` (disabled). When enabled, the service checks `order_items -> product_variants -> products_id` with order status `CONFIRMED|PROCESSING|SHIPPED|DELIVERED` - no schema change required. This implements the "Only verified customers may review purchased products **if this feature is enabled**" requirement.
- **Review images are replace-all on update**: `images` on PATCH replaces the whole set; `display_order` is auto-assigned 1..n by array index. No incremental image editing in v1.
- **Images hard-delete with the review**: `review_images` has no `deleted_at`, so review deletion (customer or admin) hard-deletes the rows in the same transaction; ImageKit files remain (consistent with the product-image convention).
- **`customer_name` is exposed in full** (first + last), consistent with the orders admin projection; masking is a possible privacy hardening.
- **Rating summary rides on the product reviews list** (`summary: { average_rating, total_count }`) rather than changing the products module contract - non-breaking for existing product endpoints.
- **LIKE wildcards are escaped** in admin search so `%`/`_` in input are treated literally (no surprise wildcard matches).
- **No schema change**: `reviews`/`review_images` already cover the surface; the only constants change is adding `PUBLIC_ID_PREFIXES.REVIEW_IMAGE: "rvimg"` (`REVIEW: "rev"` already exists).

## Constants Changes

| Constant | Change |
|----------|--------|
| `PUBLIC_ID_PREFIXES.REVIEW_IMAGE` | Add `"rvimg"` |
| `REVIEWS_REQUIRE_PURCHASE` | Add `false` (shared constant next to the shipping constants) |

