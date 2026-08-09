import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { authentication } from "../../../middleware/authentication.js";
import { authorization } from "../../../middleware/authorization.js";
import { user_role } from "../../../generated/prisma/enums.js";
import {
  createProductSchema,
  getAdminProductSchema,
  listAdminProductsSchema,
  productParamsSchema,
  updateProductSchema,
} from "../validators/product.js";
import {
  createVariantSchema,
  listVariantsSchema,
  updateVariantSchema,
  variantParamsSchema,
} from "../validators/variant.js";
import {
  createProductImageSchema,
  listProductImagesSchema,
  productImageParamsSchema,
  updateProductImageSchema,
} from "../validators/productImage.js";
import {
  createVariantImageSchema,
  listVariantImagesSchema,
  updateVariantImageSchema,
  variantImageParamsSchema,
} from "../validators/variantImage.js";
import {
  createProductController,
  deleteProductController,
  getAdminProductController,
  listAdminProductsController,
  updateProductController,
} from "../controller/product.controller.js";
import { getImageKitAuthParamsController } from "../controller/upload.controller.js";
import {
  createVariantController,
  deleteVariantController,
  getVariantController,
  listVariantsController,
  updateVariantController,
} from "../controller/variant.controller.js";
import {
  createProductImageController,
  deleteProductImageController,
  getProductImageController,
  listProductImagesController,
  updateProductImageController,
} from "../controller/productImage.controller.js";
import {
  createVariantImageController,
  deleteVariantImageController,
  getVariantImageController,
  listVariantImagesController,
  updateVariantImageController,
} from "../controller/variantImage.controller.js";

const adminProductsRouter = Router();

adminProductsRouter.use(authentication);
adminProductsRouter.use(authorization(user_role.ADMIN, user_role.SUPER_ADMIN));

adminProductsRouter.get("/uploads/imagekit-auth", getImageKitAuthParamsController);

adminProductsRouter.get("/", validate(listAdminProductsSchema), listAdminProductsController);
adminProductsRouter.post("/", validate(createProductSchema), createProductController);
adminProductsRouter.get("/:product_public_id", validate(getAdminProductSchema), getAdminProductController);
adminProductsRouter.patch("/:product_public_id", validate(updateProductSchema), updateProductController);
adminProductsRouter.delete("/:product_public_id", validate(productParamsSchema), deleteProductController);

adminProductsRouter.get("/:product_public_id/variants", validate(listVariantsSchema), listVariantsController);
adminProductsRouter.post("/:product_public_id/variants", validate(createVariantSchema), createVariantController);
adminProductsRouter.get("/:product_public_id/variants/:variant_public_id", validate(variantParamsSchema), getVariantController);
adminProductsRouter.patch("/:product_public_id/variants/:variant_public_id", validate(updateVariantSchema), updateVariantController);
adminProductsRouter.delete("/:product_public_id/variants/:variant_public_id", validate(variantParamsSchema), deleteVariantController);

adminProductsRouter.get("/:product_public_id/images", validate(listProductImagesSchema), listProductImagesController);
adminProductsRouter.post("/:product_public_id/images", validate(createProductImageSchema), createProductImageController);
adminProductsRouter.get("/:product_public_id/images/:image_public_id", validate(productImageParamsSchema), getProductImageController);
adminProductsRouter.patch("/:product_public_id/images/:image_public_id", validate(updateProductImageSchema), updateProductImageController);
adminProductsRouter.delete("/:product_public_id/images/:image_public_id", validate(productImageParamsSchema), deleteProductImageController);

adminProductsRouter.get("/:product_public_id/variants/:variant_public_id/images", validate(listVariantImagesSchema), listVariantImagesController);
adminProductsRouter.post("/:product_public_id/variants/:variant_public_id/images", validate(createVariantImageSchema), createVariantImageController);
adminProductsRouter.get("/:product_public_id/variants/:variant_public_id/images/:variant_image_public_id", validate(variantImageParamsSchema), getVariantImageController);
adminProductsRouter.patch("/:product_public_id/variants/:variant_public_id/images/:variant_image_public_id", validate(updateVariantImageSchema), updateVariantImageController);
adminProductsRouter.delete("/:product_public_id/variants/:variant_public_id/images/:variant_image_public_id", validate(variantImageParamsSchema), deleteVariantImageController);

export { adminProductsRouter };
