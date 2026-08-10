import { Prisma } from "../../../generated/prisma/client.js";

export interface PaymentResult {
  transactionReference: string;
  paidAt: Date;
}

export interface PaymentGateway {
  process(amount: Prisma.Decimal, method: string): PaymentResult;
}
