import { logger } from "../logger/index.js";

export interface SendSmsInput {
  to: string;
  message: string;
}

export async function sendSms(input: SendSmsInput): Promise<void> {
  logger.info({ to: input.to }, `[SMS] ${input.message}`);
}
