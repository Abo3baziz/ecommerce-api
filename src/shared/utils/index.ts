import { nanoid } from "nanoid";
import { PUBLIC_ID_PREFIXES } from "../constants/index.js";

type Prefix = (typeof PUBLIC_ID_PREFIXES)[keyof typeof PUBLIC_ID_PREFIXES];

export function generatePublicId(prefix: Prefix): string {
  return `${prefix}_${nanoid(12)}`;
}

export function formatPaginationMeta(page: number, limit: number, total: number) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNext: page * limit < total,
    hasPrev: page > 1,
  };
}
