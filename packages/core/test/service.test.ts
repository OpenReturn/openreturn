import { describe, expect, it } from "vitest";
import { createMockCarrierAdapters } from "@openreturn/adapters";
import { createDefaultReturnMethodRegistry } from "@openreturn/return-methods";
import {
  InMemoryReturnRepository,
  NoopNotificationDispatcher,
  ReturnService,
  canTransition
} from "../src";

function createService() {
  const notifications = new NoopNotificationDispatcher();
  return {
    notifications,
    service: new ReturnService({
      repository: new InMemoryReturnRepository(),
      carriers: createMockCarrierAdapters({ apiKey: "test" }),
      returnMethods: createDefaultReturnMethodRegistry(),
      notifications
    })
  };
}

describe("return state machine", () => {
  it("allows the core lifecycle transitions", () => {
    expect(canTransition("initiated", "label_generated")).toBe(true);
    expect(canTransition("label_generated", "shipped")).toBe(true);
    expect(canTransition("inspection", "approved")).toBe(true);
    expect(canTransition("completed", "refunded")).toBe(false);
  });
});

describe("return service", () => {
  it("initiates a refund return, generates a label, and records tracking", async () => {
    const { service, notifications } = createService();
    const record = await service.initiateReturn({
      orderId: "ORDER-1",
      customer: { email: "customer@example.com" },
      requestedResolution: "refund",
      items: [
        {
          orderItemId: "line_1",
          sku: "SKU",
          name: "Item",
          quantity: 1,
          reason: { code: "size", note: "Too small" }
        }
      ]
    });

    const labeled = await service.selectCarrier(record.id, { carrier: "postnl" });
    const shipped = await service.addTracking(labeled.id, { status: "accepted" });

    expect(record.status).toBe("initiated");
    expect(labeled.status).toBe("label_generated");
    expect(labeled.label?.trackingNumber).toContain("POSTNL");
    expect(shipped.status).toBe("shipped");
    expect(notifications.sent.map((message) => message.type)).toContain("label_ready");
  });

  it("requires exchange selection before label generation", async () => {
    const { service } = createService();
    const record = await service.initiateReturn({
      orderId: "ORDER-2",
      customer: { email: "customer@example.com" },
      requestedResolution: "exchange",
      items: [
        {
          orderItemId: "line_1",
          sku: "SKU",
          name: "Item",
          quantity: 1,
          reason: { code: "defect" }
        }
      ]
    });

    await expect(service.selectCarrier(record.id, { carrier: "dhl" })).rejects.toThrow(
      "Exchange returns require exchange selection"
    );

    await service.selectExchange(record.id, {
      requestedItems: [
        {
          originalOrderItemId: "line_1",
          replacementSku: "SKU-L",
          replacementName: "Item large",
          quantity: 1
        }
      ]
    });
    const labeled = await service.selectCarrier(record.id, { carrier: "dhl" });
    expect(labeled.label?.carrier).toBe("dhl");
  });
});
