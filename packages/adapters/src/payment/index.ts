import { randomUUID } from "node:crypto";
import type { Money, PaymentProviderCode, RefundResult } from "@openreturn/types";
import { AdapterError } from "../errors";

/** Configuration accepted by the Stripe-compatible mock payment adapter. */
export interface PaymentAdapterConfig {
  apiKey: string;
  webhookSecret?: string;
  currency?: string;
}

/** Input required to issue an idempotent refund. */
export interface RefundInput {
  orderId: string;
  amount: Money;
  reason?: string;
  idempotencyKey?: string;
}

/** Input required to charge a return shipping fee. */
export interface ReturnShippingFeeInput {
  returnId: string;
  customerEmail: string;
  amount: Money;
  description?: string;
}

/** Payment intent returned when collecting return shipping fees. */
export interface PaymentIntent {
  id: string;
  provider: PaymentProviderCode | string;
  amount: Money;
  status: "requires_payment_method" | "requires_confirmation" | "succeeded" | "cancelled";
  clientSecret: string;
  createdAt: string;
}

/** Payment integration contract for refunds and return shipping fee collection. */
export interface PaymentAdapter {
  readonly code: PaymentProviderCode | string;
  readonly name: string;
  refund(input: RefundInput): Promise<RefundResult>;
  createReturnShippingFeePayment(input: ReturnShippingFeeInput): Promise<PaymentIntent>;
  cancelPaymentIntent(id: string): Promise<void>;
}

/** Stripe-compatible mock payment adapter with idempotent refund behavior. */
export class StripePaymentAdapter implements PaymentAdapter {
  public readonly code = "stripe";
  public readonly name = "Stripe";
  private readonly refundsByIdempotencyKey = new Map<string, RefundResult>();
  private readonly paymentIntents = new Map<string, PaymentIntent>();

  public constructor(private readonly config: PaymentAdapterConfig) {}

  /** Issues a mock refund and reuses the result for repeated idempotency keys. */
  public async refund(input: RefundInput): Promise<RefundResult> {
    this.assertConfigured();
    if (!isRecord(input)) {
      throw new AdapterError("invalid_refund_request", "Refund input must be an object");
    }
    this.validateMoney(input.amount);
    if (typeof input.orderId !== "string" || input.orderId.trim().length === 0) {
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

  /** Creates a mock payment intent for a return shipping fee. */
  public async createReturnShippingFeePayment(
    input: ReturnShippingFeeInput
  ): Promise<PaymentIntent> {
    this.assertConfigured();
    if (!isRecord(input)) {
      throw new AdapterError("invalid_payment_request", "Payment input must be an object");
    }
    this.validateMoney(input.amount);
    if (
      typeof input.returnId !== "string" ||
      input.returnId.trim().length === 0 ||
      typeof input.customerEmail !== "string" ||
      input.customerEmail.trim().length === 0
    ) {
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

  /** Cancels an existing mock payment intent. */
  public async cancelPaymentIntent(id: string): Promise<void> {
    this.assertConfigured();
    const intent = this.paymentIntents.get(id);
    if (!intent) {
      throw new AdapterError("payment_intent_not_found", `Stripe payment intent not found: ${id}`);
    }
    this.paymentIntents.set(id, { ...intent, status: "cancelled" });
  }

  private validateMoney(amount: Money): void {
    if (!isRecord(amount)) {
      throw new AdapterError("invalid_money", "amount must be an object");
    }
    if (!Number.isInteger(amount.amount) || Number(amount.amount) <= 0) {
      throw new AdapterError("invalid_money", "amount.amount must be an integer greater than zero");
    }
    if (typeof amount.currency !== "string" || !/^[A-Z]{3}$/.test(amount.currency)) {
      throw new AdapterError(
        "invalid_money",
        "amount.currency must be a 3-letter ISO currency code"
      );
    }
  }

  private assertConfigured(): void {
    if (!this.config.apiKey) {
      throw new AdapterError("missing_api_key", `${this.name} API key is required`);
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
