import { describe, expect, it } from "vitest";
import { createMockCarrierAdapters } from "@openreturn/adapters";
import { createDefaultReturnMethodRegistry } from "@openreturn/return-methods";
import {
  InMemoryReturnRepository,
  type NotificationDispatcher,
  NoopNotificationDispatcher,
  notFound,
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
  it("does not create records through repository updates", async () => {
    const repository = new InMemoryReturnRepository();

    await expect(
      repository.update({
        id: "missing",
        orderId: "ORDER-MISSING",
        customer: { email: "customer@example.com" },
        status: "initiated",
        requestedResolution: "refund",
        reasonCodes: ["other"],
        items: [],
        returnMethod: "return-to-warehouse",
        tracking: [],
        events: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    ).rejects.toThrow("Return not found: missing");
    expect(notFound("x").statusCode).toBe(404);
  });

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

  it("rejects invalid lifecycle transitions and incomplete refunds", async () => {
    const { service } = createService();
    const record = await service.initiateReturn({
      orderId: "ORDER-3",
      customer: { email: "customer@example.com" },
      requestedResolution: "refund",
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

    await expect(service.updateReturn(record.id, { status: "completed" })).rejects.toThrow(
      "Invalid return state transition"
    );
    await service.updateReturn(record.id, { status: "approved" });
    await expect(service.updateReturn(record.id, { status: "refunded" })).rejects.toThrow(
      "Refunded returns require a refund result"
    );
    await expect(service.updateReturn(record.id, {})).rejects.toThrow(
      "At least one update field is required"
    );
  });

  it("requires resolution results before non-rejected returns complete", async () => {
    const { service } = createService();
    const record = await service.initiateReturn({
      orderId: "ORDER-CREDIT",
      customer: { email: "customer@example.com" },
      requestedResolution: "store_credit",
      items: [
        {
          orderItemId: "line_1",
          sku: "SKU",
          name: "Item",
          quantity: 1,
          reason: { code: "other" }
        }
      ]
    });

    await service.updateReturn(record.id, { status: "approved" });
    await expect(service.updateReturn(record.id, { status: "completed" })).rejects.toThrow(
      "Completed store credit returns require a store credit result"
    );
    const completed = await service.updateReturn(record.id, {
      status: "completed",
      storeCredit: {
        amount: { amount: 1000, currency: "EUR" },
        code: "CREDIT-1",
        issuedAt: new Date().toISOString()
      }
    });

    expect(completed.status).toBe("completed");
    expect(completed.storeCredit?.code).toBe("CREDIT-1");
  });

  it("does not fail return operations when notifications fail", async () => {
    class FailingNotifications implements NotificationDispatcher {
      public async dispatch(): Promise<void> {
        throw new Error("SMTP unavailable");
      }
    }

    const service = new ReturnService({
      repository: new InMemoryReturnRepository(),
      carriers: createMockCarrierAdapters({ apiKey: "test" }),
      returnMethods: createDefaultReturnMethodRegistry(),
      notifications: new FailingNotifications()
    });
    const record = await service.initiateReturn({
      orderId: "ORDER-NOTIFY",
      customer: { email: "customer@example.com" },
      requestedResolution: "refund",
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

    expect(record.events.at(-1)).toMatchObject({
      type: "notification.sent",
      message: "Notification failed: return_confirmation",
      data: expect.objectContaining({ delivered: false })
    });
  });

  it("records non-tracking webhooks without changing return state", async () => {
    const { service } = createService();
    const record = await service.initiateReturn({
      orderId: "ORDER-4",
      customer: { email: "customer@example.com" },
      requestedResolution: "refund",
      items: [
        {
          orderItemId: "line_1",
          sku: "SKU",
          name: "Item",
          quantity: 1,
          reason: { code: "other" }
        }
      ]
    });

    const updated = await service.receiveWebhook({
      source: "shopify",
      type: "return.note_added",
      returnId: record.id,
      data: { note: "Customer asked about timing" }
    });

    expect(updated?.status).toBe("initiated");
    expect(updated?.events.at(-1)?.type).toBe("webhook.received");
  });
});
