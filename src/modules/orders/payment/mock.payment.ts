import { nanoid } from "nanoid";
import type { PaymentGateway, PaymentResult } from "./gateway.js";

export class MockPaymentGateway implements PaymentGateway {
  process(): PaymentResult {
    return {
      transactionReference: `mock_${nanoid(12)}`,
      paidAt: new Date(),
    };
  }
}
