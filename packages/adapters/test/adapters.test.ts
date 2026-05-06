import { describe, expect, it } from "vitest";
import {
  AdapterError,
  createMockCarrierAdapters,
  createMockGenericCommerceAdapters,
  createMockPlatformAdapters,
  StripePaymentAdapter
} from "../src";

describe("adapter implementations", () => {
  it("creates labels for every built-in carrier", async () => {
    const carriers = createMockCarrierAdapters({ apiKey: "test" });
    await Promise.all(
      carriers.map(async (carrier) => {
        const label = await carrier.createLabel({
          returnId: "ret_12345678",
          orderId: "order_1",
          carrier: carrier.code,
          customer: { email: "customer@example.com" },
          items: [
            {
              orderItemId: "line_1",
              sku: "SKU",
              name: "Item",
              quantity: 1,
              reason: { code: "size" }
            }
          ]
        });
        expect(label.carrier).toBe(carrier.code);
        expect(label.trackingNumber).toContain(String(carrier.code).toUpperCase());
        expect(await carrier.trackShipment(label.trackingNumber)).toHaveLength(
          carrier.code === "budbee" ? 4 : 3
        );
      })
    );
  });

  it("rejects unsupported carrier service levels and cancelled label lookups", async () => {
    const [carrier] = createMockCarrierAdapters({ apiKey: "test" });
    const label = await carrier!.createLabel({
      returnId: "ret_12345678",
      orderId: "order_1",
      carrier: carrier!.code,
      customer: { email: "customer@example.com" },
      items: [
        {
          orderItemId: "line_1",
          sku: "SKU",
          name: "Item",
          quantity: 1,
          reason: { code: "size" }
        }
      ]
    });

    await carrier!.cancelLabel(label.id);
    await expect(carrier!.trackShipment(label.trackingNumber)).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ status: "exception" })])
    );
    await expect(
      carrier!.createLabel({
        returnId: "ret_12345678",
        orderId: "order_1",
        carrier: carrier!.code,
        serviceLevel: "same-day",
        customer: { email: "customer@example.com" },
        items: [
          {
            orderItemId: "line_1",
            sku: "SKU",
            name: "Item",
            quantity: 1,
            reason: { code: "size" }
          }
        ]
      })
    ).rejects.toThrow(AdapterError);
  });

  it("returns adapter errors instead of raw type errors for malformed runtime inputs", async () => {
    const [carrier] = createMockCarrierAdapters({ apiKey: "test" });
    const [platform] = createMockPlatformAdapters({ apiKey: "test" });
    const [generic] = createMockGenericCommerceAdapters({ apiKey: "test" });
    const stripe = new StripePaymentAdapter({ apiKey: "test" });

    await expect(
      carrier!.createLabel({
        returnId: "ret_12345678",
        orderId: "order_1",
        carrier: carrier!.code,
        customer: undefined,
        items: undefined
      } as never)
    ).rejects.toThrow(AdapterError);
    await expect(platform!.createReturnAuthorization("ORDER-1", undefined as never)).rejects.toThrow(AdapterError);
    await expect(generic!.syncReturnStatus("ret_1", "")).rejects.toThrow(AdapterError);
    await expect(
      stripe.refund({
        orderId: "ORDER-1",
        amount: { amount: 1000, currency: "eur" }
      })
    ).rejects.toThrow(AdapterError);
  });

  it("looks up orders through platform and generic adapters", async () => {
    const platform = createMockPlatformAdapters({ apiKey: "test" })[0];
    const generic = createMockGenericCommerceAdapters({ apiKey: "test" })[0];

    expect(await platform?.lookupOrder("ORDER-1", "a@example.com")).toMatchObject({
      id: "ORDER-1"
    });
    expect(await generic?.lookupOrder("ORDER-2", "b@example.com")).toMatchObject({
      id: "ORDER-2"
    });
  });

  it("processes mock Stripe refunds", async () => {
    const stripe = new StripePaymentAdapter({ apiKey: "test" });
    const refund = await stripe.refund({
      orderId: "ORDER-1",
      amount: { amount: 1000, currency: "EUR" }
    });

    expect(refund.provider).toBe("stripe");
    expect(refund.transactionId).toMatch(/^re_/);
  });

  it("creates mock Stripe payment intents and reuses idempotent refunds", async () => {
    const stripe = new StripePaymentAdapter({ apiKey: "mock" });
    const intent = await stripe.createReturnShippingFeePayment({
      returnId: "ret_1",
      customerEmail: "customer@example.com",
      amount: { amount: 499, currency: "EUR" }
    });
    const firstRefund = await stripe.refund({
      orderId: "ORDER-1",
      amount: { amount: 499, currency: "EUR" },
      idempotencyKey: "refund-ret-1"
    });
    const secondRefund = await stripe.refund({
      orderId: "ORDER-1",
      amount: { amount: 499, currency: "EUR" },
      idempotencyKey: "refund-ret-1"
    });

    expect(intent.status).toBe("succeeded");
    expect(secondRefund.transactionId).toBe(firstRefund.transactionId);
  });
});
