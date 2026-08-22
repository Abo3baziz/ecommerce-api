import { Request, Response, NextFunction } from "express";
import { env } from "../../../config/env.js";
import { getUploadAuthenticationParameters } from "../../../shared/imagekit/index.js";

export async function getImageKitAuthParamsController(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authParams = getUploadAuthenticationParameters();

    res.status(200).json({
      success: true,
      data: {
        token: authParams.token,
        expire: authParams.expire,
        signature: authParams.signature,
        publicKey: env.IMAGEKIT_PUBLIC_KEY,
        urlEndpoint: env.IMAGEKIT_URL_ENDPOINT,
      },
    });
  } catch (error) {
    next(error);
  }
}
