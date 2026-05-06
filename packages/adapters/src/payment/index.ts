import { randomUUID } from "node:crypto";
import type { Money, PaymentProviderCode, RefundResult } from "@openreturn/types";

export interface PaymentAdapterConfig {
  apiKey: string;
}

export interface RefundInput {
  orderId: string;
  amount: Money;
  reason?: string;
}

export interface PaymentAdapter {
  readonly code: PaymentProviderCode | string;
  readonly name: string;
  refund(input: RefundInput): Promise<RefundResult>;
}

export class StripePaymentAdapter implements PaymentAdapter {
  public readonly code = "stripe";
  public readonly name = "Stripe";

  public constructor(private readonly config: PaymentAdapterConfig) {}

  public async refund(input: RefundInput): Promise<RefundResult> {
    void this.config;
    return {
      amount: input.amount,
      provider: this.code,
      transactionId: `re_${randomUUID().replaceAll("-", "").slice(0, 24)}`,
      processedAt: new Date().toISOString()
    };
  }
}
