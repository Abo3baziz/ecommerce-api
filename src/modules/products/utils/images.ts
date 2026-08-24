import type { ProductPrimaryImageResult } from "../dto/product.js";

export interface PrimaryImageLikeRow {
  image_url: string;
  alt_text: string | null;
  is_primary: boolean;
  display_order: number;
}

/**
 * Picks the image a card/thumbnail should show: the flagged primary when
 * present, otherwise the first image in display order. Input rows are
 * expected sorted by display_order ascending.
 */
export function resolvePrimaryImage(
  images: readonly PrimaryImageLikeRow[],
): ProductPrimaryImageResult | null {
  if (images.length === 0) {
    return null;
  }

  const primary = images.find((image) => image.is_primary) ?? images[0];
  return { image_url: primary.image_url, alt_text: primary.alt_text };
}
