import { z } from "zod";
import {
  booleanQuery,
  optionalBooleanQuery,
  paginationQuery,
  publicIdParam,
  searchQuery,
  slugField,
  sortQuery,
} from "./common.js";

const CATEGORY_SORT_FIELDS = ["name", "created_at", "updated_at"] as const;

const nameField = z.string().trim().min(1).max(255);
const descriptionField = z.string().trim().max(10000);
const isActiveField = z.boolean();

export const createCategorySchema = z.object({
  body: z.object({
    slug: slugField.optional(),
    name: nameField,
    description: descriptionField.optional(),
    is_active: isActiveField.optional(),
  }),
});

export type CreateCategoryBody = z.infer<typeof createCategorySchema.shape.body>;

export const updateCategorySchema = z.object({
  params: z.object({
    category_public_id: publicIdParam,
  }),
  body: z.object({
    slug: slugField.optional(),
    name: nameField.optional(),
    description: descriptionField.nullish(),
    is_active: isActiveField.optional(),
  }),
});

export type UpdateCategoryBody = z.infer<typeof updateCategorySchema.shape.body>;

export const categoryParamsSchema = z.object({
  params: z.object({
    category_public_id: publicIdParam,
  }),
});

export type CategoryParams = z.infer<typeof categoryParamsSchema.shape.params>;

export const categoryProductParamsSchema = z.object({
  params: z.object({
    category_public_id: publicIdParam,
    product_public_id: publicIdParam,
  }),
});

export type CategoryProductParams = z.infer<
  typeof categoryProductParamsSchema.shape.params
>;

const baseListQuery = {
  ...paginationQuery,
  search: searchQuery,
  sort: sortQuery(CATEGORY_SORT_FIELDS, "name"),
};

export const listCategoriesSchema = z.object({
  query: z.object(baseListQuery),
});

export type ListCategoriesQuery = z.infer<typeof listCategoriesSchema.shape.query>;

export const listAdminCategoriesSchema = z.object({
  query: z.object({
    ...baseListQuery,
    is_active: optionalBooleanQuery(),
    include_deleted: booleanQuery(false),
  }),
});

export type ListAdminCategoriesQuery = z.infer<
  typeof listAdminCategoriesSchema.shape.query
>;

export const listCategoryProductsSchema = z.object({
  params: z.object({
    category_public_id: publicIdParam,
  }),
  query: z.object({
    ...paginationQuery,
    search: searchQuery,
    sort: sortQuery(CATEGORY_SORT_FIELDS, "-created_at"),
  }),
});

export type ListCategoryProductsQuery = z.infer<
  typeof listCategoryProductsSchema.shape.query
>;
