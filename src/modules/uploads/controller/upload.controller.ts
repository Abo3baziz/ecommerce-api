import { Request, Response, NextFunction } from "express";
import { env } from "../../../config/env.js";
import {
  getUploadAuthenticationParameters,
  resolveUploadFolder,
  type ImageKitUploadContext,
} from "../../../shared/imagekit/index.js";

/**
 * Builds an auth-params handler with a fixed default context. The optional
 * ?context= query overrides the default within the allowlist. The resolved
 * folder is echoed back so clients pass it to the ImageKit upload form.
 */
export function createImageKitAuthParamsController(
  defaultContext: ImageKitUploadContext,
): (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void> {
  return async function imageKitAuthParamsController(req, res, next) {
    try {
      const context =
        (req.query.context as ImageKitUploadContext | undefined) ??
        defaultContext;
      const folder = resolveUploadFolder(context, defaultContext);
      const authParams = getUploadAuthenticationParameters();

      res.status(200).json({
        success: true,
        data: {
          token: authParams.token,
          expire: authParams.expire,
          signature: authParams.signature,
          publicKey: env.IMAGEKIT_PUBLIC_KEY,
          urlEndpoint: env.IMAGEKIT_URL_ENDPOINT,
          folder,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

// Customer surface (review photos) defaults to the reviews folder.
export const getImageKitAuthParamsController =
  createImageKitAuthParamsController("reviews");
