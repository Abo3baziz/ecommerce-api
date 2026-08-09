export { categoriesRouter } from "./routes/category.routes.js";
export { adminCategoriesRouter } from "./routes/admin.routes.js";
export {
  assignProductToCategory,
  createCategory,
  deleteCategory,
  getAdminCategory,
  getCategory,
  listAdminCategories,
  listCategories,
  listCategoryProducts,
  unassignProductFromCategory,
  updateCategory,
} from "./service/category.service.js";
