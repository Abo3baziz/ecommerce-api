import { Request, Response, NextFunction } from "express";
import {
  createAddress,
  deleteAddress,
  getAddress,
  listAddresses,
  updateAddress,
} from "../service/address.service.js";
import type { CreateAddressBody, UpdateAddressBody } from "../validators/address.js";
import type { ListAddressesQuery } from "../validators/address.js";
import type { AddressParams } from "../validators/address.js";

export async function listAddressesController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { page, limit } = req.query as unknown as ListAddressesQuery;
    const result = await listAddresses(req.user!.id, page, limit);
    res.status(200).json({
      success: true,
      data: result.addresses,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
}

export async function createAddressController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await createAddress(
      req.user!.id,
      req.body as CreateAddressBody,
    );
    res.status(201).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function getAddressController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { address_public_id } = req.params as AddressParams;
    const data = await getAddress(req.user!.id, address_public_id);
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateAddressController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { address_public_id } = req.params as AddressParams;
    const data = await updateAddress(
      req.user!.id,
      address_public_id,
      req.body as UpdateAddressBody,
    );
    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteAddressController(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { address_public_id } = req.params as AddressParams;
    await deleteAddress(req.user!.id, address_public_id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
