import { prisma } from "../../src/config/database.js";

export async function createCategoryProductLink(
  categoriesId: number,
  productsId: number,
) {
  return prisma.product_categories.create({
    data: {
      categories_id: categoriesId,
      products_id: productsId,
      created_at: new Date(),
    },
  });
}
