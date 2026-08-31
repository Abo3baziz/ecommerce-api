import { Prisma } from "../../generated/prisma/client.js";

export type MoneyValue = string | number | Prisma.Decimal;

const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "EGP", "SAR", "AED"] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export function isSupportedCurrency(value: string): value is SupportedCurrency {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(value);
}

export function toDecimalString(value: MoneyValue): string {
  if (value instanceof Prisma.Decimal) return value.toString();
  return String(value);
}

export function formatMoney(
  value: MoneyValue,
  currency: string = "USD",
): string {
  const str = toDecimalString(value);
  const num = Number(str);
  if (Number.isNaN(num)) return str;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  } catch {
    return `${currency} ${num.toFixed(2)}`;
  }
}

export function formatNumber(value: MoneyValue): string {
  const str = toDecimalString(value);
  const num = Number(str);
  if (Number.isNaN(num)) return str;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatPct(value: MoneyValue): string {
  const str = toDecimalString(value);
  const num = Number(str);
  if (Number.isNaN(num)) return `${str}%`;
  return `${num.toFixed(1)}%`;
}

export function formatDateUTC(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().slice(0, 10);
}

export function formatDateTimeUTC(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

export function formatBucketLabel(iso: string, bucket: "day" | "month"): string {
  const d = new Date(iso);
  if (bucket === "month") {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return d.toISOString().slice(0, 10);
}
