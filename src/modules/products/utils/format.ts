import { Prisma } from "../../../generated/prisma/client.js";

export function decimalToFixed(value: Prisma.Decimal | null): string | null {
  return value ? value.toFixed(2) : null;
}

export function computeFinalPrice(
  price: Prisma.Decimal,
  discountPercentage: Prisma.Decimal | null,
): string {
  if (discountPercentage && discountPercentage.gt(0)) {
    return price.minus(price.mul(discountPercentage).div(100)).toFixed(2);
  }
  return price.toFixed(2);
}
