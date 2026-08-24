import { describe, expect, it } from "vitest";
import { validateUploadedImageUrl } from "../../../src/shared/imagekit/uploads.js";

const ENDPOINT = "https://ik.imagekit.io/ecommerceImages";
const BASE = `${ENDPOINT}/ecommerce/products`;

describe("validateUploadedImageUrl", () => {
  it("accepts a valid product image URL", () => {
    expect(() =>
      validateUploadedImageUrl(`${BASE}/photo_abc.png`, "products", ENDPOINT),
    ).not.toThrow();
  });

  it("accepts each allowed extension and review-context URLs", () => {
    for (const url of [
      `${BASE}/a.jpg`,
      `${BASE}/a.jpeg`,
      `${BASE}/a.png`,
      `${ENDPOINT}/ecommerce/reviews/r1.webp`,
    ]) {
      const context = url.includes("/reviews/") ? "reviews" : "products";
      expect(() => validateUploadedImageUrl(url, context, ENDPOINT)).not.toThrow();
    }
  });

  it("rejects hosts outside the configured ImageKit endpoint", () => {
    expect(() =>
      validateUploadedImageUrl("https://evil.io/ecommerce/products/x.png", "products", ENDPOINT),
    ).toThrow(/configured ImageKit endpoint/);
  });

  it("rejects paths outside the endpoint pathname", () => {
    expect(() =>
      validateUploadedImageUrl("https://ik.imagekit.io/other/ecommerce/products/x.png", "products", ENDPOINT),
    ).toThrow(/configured ImageKit endpoint/);
  });

  it("rejects URLs outside the context folder", () => {
    expect(() =>
      validateUploadedImageUrl(`${ENDPOINT}/debug-temp/x.png`, "products", ENDPOINT),
    ).toThrow(/ecommerce\/products folder/);
  });

  it("rejects cross-context folder usage", () => {
    expect(() =>
      validateUploadedImageUrl(`${ENDPOINT}/ecommerce/reviews/r.png`, "products", ENDPOINT),
    ).toThrow(/ecommerce\/products folder/);
  });

  it("rejects non-image extensions", () => {
    expect(() =>
      validateUploadedImageUrl(`${BASE}/x.gif`, "products", ENDPOINT),
    ).toThrow(/JPG, PNG and WebP/);
  });

  it("rejects unparseable URLs", () => {
    expect(() => validateUploadedImageUrl("not-a-url", "products", ENDPOINT)).toThrow(
      /Invalid upload URL/,
    );
  });

  it("tolerates a trailing slash on the configured endpoint", () => {
    expect(() =>
      validateUploadedImageUrl(`${BASE}/a.png`, "products", `${ENDPOINT}/`),
    ).not.toThrow();
  });
});
