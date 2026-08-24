import { nanoid } from "nanoid";
import { env } from "../../src/config/env.js";

/**
 * Builds an image URL that satisfies validateUploadedImageUrl: same ImageKit
 * endpoint host, inside the folder allowlist for the given context.
 */
export function imageKitImageUrl(
  path: string = `${nanoid(6)}.jpg`,
  context: "products" | "reviews" = "products",
): string {
  return `${env.IMAGEKIT_URL_ENDPOINT}/ecommerce/${context}/${path}`;
}
