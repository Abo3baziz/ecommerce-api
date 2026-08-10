import { dbSchema, prisma } from "../../../config/database.js";
import { Prisma } from "../../../generated/prisma/client.js";
import { order_status } from "../../../generated/prisma/enums.js";
import { PUBLIC_ID_PREFIXES } from "../../../shared/constants/index.js";
import { generatePublicId } from "../../../shared/utils/index.js";

type DbClient = Prisma.TransactionClient | typeof prisma;

const reviewWithContextSelect = {
  id: true,
  public_id: true,
  rating: true,
  title: true,
  comment: true,
  is_approved: true,
  created_at: true,
  updated_at: true,
  deleted_at: true,
  users: {
    select: {
      public_id: true,
      first_name: true,
      last_name: true,
      email: true,
    },
  },
  products: {
    select: {
      public_id: true,
      name: true,
      slug: true,
    },
  },
  review_images: {
    orderBy: [
      { display_order: "asc" },
      { created_at: "asc" },
      { id: "asc" },
    ] as Prisma.review_imagesOrderByWithRelationInput[],
    select: {
      public_id: true,
      image_url: true,
      alt_text: true,
      display_order: true,
    },
  },
} as const;

export type ReviewRow = Prisma.reviewsGetPayload<{
  select: typeof reviewWithContextSelect;
}>;

export interface CustomerReviewFilters {
  products_id?: number;
  rating?: number;
  is_approved?: boolean;
  include_deleted?: boolean;
}

export interface OwnReviewFilters {
  users_id: number;
}

export interface AdminReviewFilters {
  search?: string;
  rating?: number;
  is_approved?: boolean;
  include_deleted?: boolean;
}

export interface CreateReviewData {
  public_id: string;
  users_id: number;
  products_id: number;
  rating: number;
  title: string | null;
  comment: string | null;
}

export interface UpdateReviewData {
  rating?: number;
  title?: string | null;
  comment?: string | null;
  is_approved?: boolean;
}

export interface CreateReviewImageData {
  public_id: string;
  image_url: string;
  alt_text: string | null;
  display_order: number | null;
}

export interface AdminReviewRowRaw {
  id: number;
  public_id: string;
  rating: number;
  title: string | null;
  comment: string | null;
  is_approved: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  customer_public_id: string;
  customer_name: string;
  customer_email: string;
  product_public_id: string;
  product_name: string;
  product_slug: string;
}

const QUALIFYING_PURCHASE_STATUSES = [
  order_status.CONFIRMED,
  order_status.PROCESSING,
  order_status.SHIPPED,
  order_status.DELIVERED,
] as const;

const reviewsTable = Prisma.raw(`"${dbSchema}"."reviews"`);
const usersTable = Prisma.raw(`"${dbSchema}"."users"`);
const productsTable = Prisma.raw(`"${dbSchema}"."products"`);
const orderItemsTable = Prisma.raw(`"${dbSchema}"."order_items"`);
const variantsTable = Prisma.raw(`"${dbSchema}"."product_variants"`);
const ordersTable = Prisma.raw(`"${dbSchema}"."orders"`);

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

function buildCustomerWhere(filters: CustomerReviewFilters): Prisma.reviewsWhereInput {
  const where: Prisma.reviewsWhereInput = {
    deleted_at: null,
    is_approved: filters.is_approved ?? true,
  };

  if (filters.products_id !== undefined) {
    where.products_id = filters.products_id;
  }

  if (filters.rating !== undefined) {
    where.rating = filters.rating;
  }

  return where;
}

function buildOwnWhere(filters: OwnReviewFilters): Prisma.reviewsWhereInput {
  return {
    users_id: filters.users_id,
    deleted_at: null,
  };
}

function buildAdminWhere(filters: AdminReviewFilters): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];

  conditions.push(
    filters.include_deleted
      ? Prisma.sql`1 = 1`
      : Prisma.sql`r.deleted_at IS NULL`,
  );

  if (filters.is_approved !== undefined) {
    conditions.push(Prisma.sql`r.is_approved = ${filters.is_approved}`);
  }

  if (filters.rating !== undefined) {
    conditions.push(Prisma.sql`r.rating = ${filters.rating}`);
  }

  if (filters.search) {
    const pattern = `%${escapeLikePattern(filters.search)}%`;
    conditions.push(
      Prisma.sql`(
        p.name ILIKE ${pattern} ESCAPE '\\' OR
        r.title ILIKE ${pattern} ESCAPE '\\' OR
        r.comment ILIKE ${pattern} ESCAPE '\\' OR
        u.email ILIKE ${pattern} ESCAPE '\\' OR
        (u.first_name || ' ' || u.last_name) ILIKE ${pattern} ESCAPE '\\'
      )`,
    );
  }

  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
}

const adminFromJoins = Prisma.sql`
  FROM ${reviewsTable} r
  JOIN ${usersTable} u ON u.id = r.users_id
  JOIN ${productsTable} p ON p.id = r.products_id
`;

export const reviewRepository = {
  findProductIdByPublicId(public_id: string) {
    return prisma.products.findFirst({
      where: {
        public_id,
        deleted_at: null,
      },
      select: { id: true },
    });
  },

  findExistingReviewByUserAndProduct(users_id: number, products_id: number) {
    return prisma.reviews.findFirst({
      where: {
        users_id,
        products_id,
        deleted_at: null,
      },
      select: { id: true },
    });
  },

  hasQualifyingPurchase(
    users_id: number,
    products_id: number,
    client: DbClient = prisma,
  ) {
    return client.order_items.findFirst({
      where: {
        product_variants: {
          products_id,
        },
        orders: {
          users_id,
          status: { in: [...QUALIFYING_PURCHASE_STATUSES] },
        },
      },
      select: { id: true },
    });
  },

  createReview(data: CreateReviewData, client: DbClient = prisma) {
    const now = new Date();
    return client.reviews.create({
      data: {
        public_id: data.public_id,
        users_id: data.users_id,
        products_id: data.products_id,
        rating: data.rating,
        title: data.title,
        comment: data.comment,
        is_approved: true,
        created_at: now,
        updated_at: now,
      },
      select: reviewWithContextSelect,
    });
  },

  createReviewImages(
    reviews_id: number,
    items: CreateReviewImageData[],
    client: DbClient = prisma,
  ) {
    const now = new Date();
    return client.review_images.createMany({
      data: items.map((item) => ({
        reviews_id,
        public_id: item.public_id,
        image_url: item.image_url,
        alt_text: item.alt_text,
        display_order: item.display_order,
        created_at: now,
        updated_at: now,
      })),
    });
  },

  findCustomerReviewByPublicId(public_id: string) {
    return prisma.reviews.findFirst({
      where: {
        public_id,
        is_approved: true,
        deleted_at: null,
        products: {
          deleted_at: null,
        },
      },
      select: reviewWithContextSelect,
    });
  },

  findOwnReviewByPublicId(
    public_id: string,
    users_id: number,
    client: DbClient = prisma,
  ) {
    return client.reviews.findFirst({
      where: {
        public_id,
        users_id,
        deleted_at: null,
      },
      select: reviewWithContextSelect,
    });
  },

  findAdminReviewByPublicId(public_id: string) {
    return prisma.reviews.findFirst({
      where: { public_id },
      select: reviewWithContextSelect,
    });
  },

  updateReview(
    id: number,
    data: UpdateReviewData,
    client: DbClient = prisma,
  ) {
    return client.reviews.update({
      where: { id },
      data: {
        ...data,
        updated_at: new Date(),
      },
      select: reviewWithContextSelect,
    });
  },

  deleteReviewImages(reviews_id: number, client: DbClient = prisma) {
    return client.review_images.deleteMany({
      where: { reviews_id },
    });
  },

  softDeleteReview(id: number, client: DbClient = prisma) {
    const now = new Date();
    return client.reviews.update({
      where: { id },
      data: {
        deleted_at: now,
        updated_at: now,
      },
    });
  },

  listProductReviews(
    filters: CustomerReviewFilters,
    orderBy: Prisma.reviewsOrderByWithRelationInput,
    sortDirection: "asc" | "desc",
    skip: number,
    take: number,
  ) {
    return prisma.reviews.findMany({
      where: buildCustomerWhere(filters),
      orderBy: [
        orderBy,
        { id: sortDirection },
      ] as Prisma.reviewsOrderByWithRelationInput[],
      skip,
      take,
      select: reviewWithContextSelect,
    });
  },

  countProductReviews(filters: CustomerReviewFilters) {
    return prisma.reviews.count({
      where: buildCustomerWhere(filters),
    });
  },

  async aggregateProductReviews(filters: CustomerReviewFilters) {
    const result = await prisma.reviews.aggregate({
      where: buildCustomerWhere(filters),
      _avg: { rating: true },
      _count: { _all: true },
    });
    return {
      average: result._avg.rating,
      total: result._count._all,
    };
  },

  listOwnReviews(
    filters: OwnReviewFilters,
    orderBy: Prisma.reviewsOrderByWithRelationInput,
    sortDirection: "asc" | "desc",
    skip: number,
    take: number,
  ) {
    return prisma.reviews.findMany({
      where: buildOwnWhere(filters),
      orderBy: [
        orderBy,
        { id: sortDirection },
      ] as Prisma.reviewsOrderByWithRelationInput[],
      skip,
      take,
      select: reviewWithContextSelect,
    });
  },

  countOwnReviews(filters: OwnReviewFilters) {
    return prisma.reviews.count({
      where: buildOwnWhere(filters),
    });
  },

  listAdminReviews(
    filters: AdminReviewFilters,
    sortField: "created_at" | "rating",
    sortDirection: "asc" | "desc",
    skip: number,
    take: number,
  ) {
    const column = sortField === "created_at" ? "r.created_at" : "r.rating";
    const sqlDirection = sortDirection === "desc" ? "DESC" : "ASC";
    return prisma.$queryRaw<AdminReviewRowRaw[]>`
      SELECT
        r.id AS id,
        r.public_id AS public_id,
        r.rating AS rating,
        r.title AS title,
        r.comment AS comment,
        r.is_approved AS is_approved,
        r.created_at AS created_at,
        r.updated_at AS updated_at,
        r.deleted_at AS deleted_at,
        u.public_id AS customer_public_id,
        (u.first_name || ' ' || u.last_name) AS customer_name,
        u.email AS customer_email,
        p.public_id AS product_public_id,
        p.name AS product_name,
        p.slug AS product_slug
      ${adminFromJoins}
      ${buildAdminWhere(filters)}
      ORDER BY ${Prisma.raw(column)} ${Prisma.raw(sqlDirection)}, r.id ${Prisma.raw(sqlDirection)}
      LIMIT ${take} OFFSET ${skip}
    `;
  },

  async countAdminReviews(filters: AdminReviewFilters) {
    const rows = await prisma.$queryRaw<{ total: number }[]>`
      SELECT count(*)::int AS total
      ${adminFromJoins}
      ${buildAdminWhere(filters)}
    `;
    return rows[0]?.total ?? 0;
  },
};

export function newReviewImagePublicId(): string {
  return generatePublicId(PUBLIC_ID_PREFIXES.REVIEW_IMAGE);
}
