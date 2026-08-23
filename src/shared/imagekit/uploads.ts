import { BadRequestError } from "../../shared/errors/BadRequestError.js";

/**
 * Server-controlled folder organization for direct ImageKit uploads. Each
 * context maps to exactly one folder; clients may only request folders from
 * this allowlist, and every persisted upload reference is re-validated
 * against the same map.
 */
export const IMAGEKIT_UPLOAD_FOLDERS = {
  products: "ecommerce/products",
  reviews: "ecommerce/reviews",
} as const;

export type ImageKitUploadContext = keyof typeof IMAGEKIT_UPLOAD_FOLDERS;

export const IMAGEKIT_UPLOAD_CONTEXTS = Object.keys(
  IMAGEKIT_UPLOAD_FOLDERS,
) as ImageKitUploadContext[];

const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

export function resolveUploadFolder(
  context?: string,
  fallback: ImageKitUploadContext = "products",
): string {
  const key = (context ?? fallback) as ImageKitUploadContext;
  return IMAGEKIT_UPLOAD_FOLDERS[key] ?? IMAGEKIT_UPLOAD_FOLDERS[fallback];
}

function extensionOf(url: string): string {
  const path = url.split("?")[0] ?? "";
  const last = path.substring(path.lastIndexOf("/") + 1);
  const dot = last.lastIndexOf(".");
  return dot === -1 ? "" : last.slice(dot + 1).toLowerCase();
}

/**
 * Validates a client-reported upload URL before it is persisted anywhere:
 * same ImageKit host, inside the expected folder, with an allowed image
 * extension. Throws 400 on violation — direct uploads bypass our server, so
 * this is the security boundary for what we are willing to reference.
 */
export function validateUploadedImageUrl(
  url: string,
  context: ImageKitUploadContext,
  urlEndpoint: string,
): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new BadRequestError("Invalid upload URL");
  }

  const base = new URL(urlEndpoint);
  if (parsed.host !== base.host || !parsed.pathname.startsWith(base.pathname)) {
    throw new BadRequestError("Upload URL must point to the configured ImageKit endpoint");
  }

  const expectedFolder = IMAGEKIT_UPLOAD_FOLDERS[context];
  if (!parsed.pathname.startsWith(`${base.pathname}${expectedFolder}/`)) {
    throw new BadRequestError(
      `Upload URL must live inside the ${expectedFolder} folder`,
    );
  }

  if (!ALLOWED_EXTENSIONS.includes(extensionOf(url))) {
    throw new BadRequestError("Only JPG, PNG and WebP images are allowed");
  }
}
