export const PUBLIC_ID_PREFIXES = {
  USER: "usr",
  PRODUCT: "prd",
  CATEGORY: "cat",
  VARIANT: "var",
  ORDER: "ord",
  ORDER_ITEM: "oit",
  CART: "crt",
  CART_ITEM: "ci",
  REVIEW: "rev",
  PAYMENT: "pay",
  ADDRESS: "adr",
  VERIFICATION: "vrf",
  SESSION: "ses",
} as const;

export const ROLES = {
  CUSTOMER: "customer",
  ADMIN: "admin",
} as const;

export const ORDER_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  PROCESSING: "processing",
  SHIPPED: "shipped",
  DELIVERED: "delivered",
  CANCELLED: "cancelled",
  REFUNDED: "refunded",
} as const;

export const PAYMENT_STATUS = {
  PENDING: "pending",
  COMPLETED: "completed",
  FAILED: "failed",
  REFUNDED: "refunded",
} as const;

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export const EMAIL_BRAND_NAME = "Ecommerce";
