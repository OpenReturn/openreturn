import { randomUUID } from "node:crypto";
import type { Money, PaymentProviderCode, RefundResult } from "@openreturn/types";
import { AdapterError } from "../errors";

export interface PaymentAdapterConfig {
  apiKey: string;
  webhookSecret?: string;
  currency?: string;
}

export interface RefundInput {
  orderId: string;
  amount: Money;
  reason?: string;
  idempotencyKey?: string;
}

export interface ReturnShippingFeeInput {
  returnId: string;
  customerEmail: string;
  amount: Money;
  description?: string;
}

export interface PaymentIntent {
  id: string;
  provider: PaymentProviderCode | string;
  amount: Money;
  status: "requires_payment_method" | "requires_confirmation" | "succeeded" | "cancelled";
  clientSecret: string;
  createdAt: string;
}

export interface PaymentAdapter {
  readonly code: PaymentProviderCode | string;
  readonly name: string;
  refund(input: RefundInput): Promise<RefundResult>;
  createReturnShippingFeePayment(input: ReturnShippingFeeInput): Promise<PaymentIntent>;
  cancelPaymentIntent(id: string): Promise<void>;
}

export class StripePaymentAdapter implements PaymentAdapter {
  public readonly code = "stripe";
  public readonly name = "Stripe";
  private readonly refundsByIdempotencyKey = new Map<string, RefundResult>();
  private readonly paymentIntents = new Map<string, PaymentIntent>();

  public constructor(private readonly config: PaymentAdapterConfig) {}

  public async refund(input: RefundInput): Promise<RefundResult> {
    this.validateMoney(input.amount);
    if (!input.orderId) {
      throw new AdapterError("invalid_refund_request", "orderId is required for Stripe refunds");
    }
    if (input.idempotencyKey) {
      const existing = this.refundsByIdempotencyKey.get(input.idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    const refund: RefundResult = {
      amount: input.amount,
      provider: this.code,
      transactionId: `re_${randomUUID().replaceAll("-", "").slice(0, 24)}`,
      processedAt: new Date().toISOString()
    };
    if (input.idempotencyKey) {
      this.refundsByIdempotencyKey.set(input.idempotencyKey, refund);
    }
    return refund;
  }

  public async createReturnShippingFeePayment(
    input: ReturnShippingFeeInput
  ): Promise<PaymentIntent> {
    this.validateMoney(input.amount);
    if (!input.returnId || !input.customerEmail) {
      throw new AdapterError(
        "invalid_payment_request",
        "returnId and customerEmail are required for return shipping fee payments"
      );
    }
    const id = `pi_${randomUUID().replaceAll("-", "").slice(0, 24)}`;
    const intent: PaymentIntent = {
      id,
      provider: this.code,
      amount: input.amount,
      status: this.config.apiKey === "mock" ? "succeeded" : "requires_confirmation",
      clientSecret: `${id}_secret_${randomUUID().replaceAll("-", "").slice(0, 16)}`,
      createdAt: new Date().toISOString()
    };
    this.paymentIntents.set(id, intent);
    return intent;
  }

  public async cancelPaymentIntent(id: string): Promise<void> {
    const intent = this.paymentIntents.get(id);
    if (!intent) {
      throw new AdapterError("payment_intent_not_found", `Stripe payment intent not found: ${id}`);
    }
    this.paymentIntents.set(id, { ...intent, status: "cancelled" });
  }

  private validateMoney(amount: Money): void {
    if (!Number.isInteger(amount.amount) || amount.amount <= 0) {
      throw new AdapterError("invalid_money", "amount.amount must be an integer greater than zero");
    }
    if (!amount.currency || amount.currency.length !== 3) {
      throw new AdapterError("invalid_money", "amount.currency must be a 3-letter ISO currency code");
    }
  }
}
