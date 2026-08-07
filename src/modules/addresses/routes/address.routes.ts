import { Router } from "express";
import { validate } from "../../../middleware/validate.js";
import { authentication } from "../../../middleware/authentication.js";
import { createAddressSchema, updateAddressSchema } from "../validators/address.js";
import { addressParamsSchema, listAddressesSchema } from "../validators/address.js";
import {
  createAddressController,
  deleteAddressController,
  getAddressController,
  listAddressesController,
  updateAddressController,
} from "../controller/address.controller.js";

const addressesRouter = Router();

addressesRouter.use(authentication);

addressesRouter.get("/me/addresses", validate(listAddressesSchema), listAddressesController);
addressesRouter.post("/me/addresses", validate(createAddressSchema), createAddressController);
addressesRouter.get("/me/addresses/:address_public_id", validate(addressParamsSchema), getAddressController);
addressesRouter.patch("/me/addresses/:address_public_id", validate(updateAddressSchema), updateAddressController);
addressesRouter.delete("/me/addresses/:address_public_id", validate(addressParamsSchema), deleteAddressController);

export { addressesRouter };
