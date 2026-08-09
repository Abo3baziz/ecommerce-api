import { z } from "zod";
import {
  booleanQuery,
  brandQuery,
  paginationQuery,
  publicIdParam,
  searchQuery,
  slugField,
  sortQuery,
} from "./common.js";

const PRODUCT_SORT_FIELDS = ["name", "created_at", "updated_at"] as const;

const nameField = z.string().trim().min(1).max(255);
const descriptionField = z.string().trim().max(10000);
const brandField = z.string().trim().max(255);

export const createProductSchema = z.object({
  body: z.object({
    slug: slugField.optional(),
    name: nameField,
    description: descriptionField.optional(),
    brand: brandField.optional(),
  }),
});

export type CreateProductBody = z.infer<typeof createProductSchema.shape.body>;

export const updateProductSchema = z.object({
  params: z.object({
    product_public_id: publicIdParam,
  }),
  body: z.object({
    slug: slugField.optional(),
    name: nameField.optional(),
    description: descriptionField.nullish(),
    brand: brandField.nullish(),
  }),
});

export type UpdateProductBody = z.infer<typeof updateProductSchema.shape.body>;

export const productParamsSchema = z.object({
  params: z.object({
    product_public_id: publicIdParam,
  }),
});

export type ProductParams = z.infer<typeof productParamsSchema.shape.params>;

const baseListQuery = {
  ...paginationQuery,
  search: searchQuery,
  brand: brandQuery,
  sort: sortQuery(PRODUCT_SORT_FIELDS, "-created_at"),
};

export const listProductsSchema = z.object({
  query: z.object(baseListQuery),
});

export type ListProductsQuery = z.infer<typeof listProductsSchema.shape.query>;

export const listAdminProductsSchema = z.object({
  query: z.object({
    ...baseListQuery,
    include_deleted: booleanQuery(false),
  }),
});

export type ListAdminProductsQuery = z.infer<typeof listAdminProductsSchema.shape.query>;

export const getAdminProductSchema = z.object({
  params: z.object({
    product_public_id: publicIdParam,
  }),
  query: z.object({
    include_deleted_variants: booleanQuery(false),
  }),
});

export type GetAdminProductQuery = z.infer<typeof getAdminProductSchema.shape.query>;
