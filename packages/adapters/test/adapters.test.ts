import { describe, expect, it } from "vitest";
import {
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
      })
    );
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
});
