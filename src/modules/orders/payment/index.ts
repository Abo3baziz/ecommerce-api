import type { PaymentGateway } from "./gateway.js";
import { MockPaymentGateway } from "./mock.payment.js";

export type { PaymentGateway, PaymentResult } from "./gateway.js";

const gateways: Record<string, PaymentGateway> = {
  mock: new MockPaymentGateway(),
};

export function getPaymentGateway(method: string): PaymentGateway {
  const gateway = gateways[method];
  if (!gateway) {
    throw new Error(`Unsupported payment method: ${method}`);
  }
  return gateway;
}
