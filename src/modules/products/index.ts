export { productsRouter } from "./routes/product.routes.js";
export { adminProductsRouter } from "./routes/admin.routes.js";
export {
  createProduct,
  deleteProduct,
  getAdminProduct,
  getProduct,
  listAdminProducts,
  listProducts,
  updateProduct,
} from "./service/product.service.js";
export {
  createVariant,
  deleteVariant,
  getVariant,
  listVariants,
  updateVariant,
} from "./service/variant.service.js";
export {
  createProductImage,
  deleteProductImage,
  getProductImage,
  listProductImages,
  updateProductImage,
} from "./service/productImage.service.js";
export {
  createVariantImage,
  deleteVariantImage,
  getVariantImage,
  listVariantImages,
  updateVariantImage,
} from "./service/variantImage.service.js";
