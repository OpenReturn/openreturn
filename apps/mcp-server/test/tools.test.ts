import { describe, expect, it, vi } from "vitest";
import { ProtocolValidationError } from "@openreturn/types";
import type { OpenReturnApiClient } from "../src/api-client";
import { callTool, tools } from "../src/tools";

describe("MCP tools", () => {
  it("registers the required OpenReturn tools", () => {
    expect(tools.map((tool) => tool.name)).toEqual([
      "discover_openreturn",
      "lookup_order",
      "list_returns",
      "initiate_return",
      "get_return_status",
      "update_return",
      "select_exchange",
      "select_carrier",
      "get_label",
      "track_return",
      "get_return_events",
      "receive_webhook"
    ]);
  });

  it("validates tool arguments before calling the REST client", async () => {
    await expect(
      callTool({} as OpenReturnApiClient, "track_return", { id: "ret_1", status: "lost" })
    ).rejects.toThrow(ProtocolValidationError);
  });

  it("dispatches typed tool calls to the REST client", async () => {
    const client = {
      discover: vi.fn().mockResolvedValue({ protocol: "openreturn" }),
      lookupOrder: vi.fn().mockResolvedValue({ order: { id: "ORDER-1" } }),
      listReturns: vi.fn().mockResolvedValue({ returns: [] }),
      initiateReturn: vi.fn().mockResolvedValue({ return: { id: "ret_1" } }),
      getReturnStatus: vi.fn().mockResolvedValue({ return: { id: "ret_1" } })
    };

    await expect(callTool(client as unknown as OpenReturnApiClient, "get_return_status", { id: "ret_1" })).resolves.toEqual({
      return: { id: "ret_1" }
    });
    expect(client.getReturnStatus).toHaveBeenCalledWith("ret_1");
    await expect(callTool(client as unknown as OpenReturnApiClient, "discover_openreturn", {})).resolves.toEqual({
      protocol: "openreturn"
    });
    await expect(
      callTool(client as unknown as OpenReturnApiClient, "lookup_order", { orderId: "ORDER-1" })
    ).resolves.toEqual({ order: { id: "ORDER-1" } });
    await expect(
      callTool(client as unknown as OpenReturnApiClient, "list_returns", { status: "initiated" })
    ).resolves.toEqual({ returns: [] });
    await expect(
      callTool(client as unknown as OpenReturnApiClient, "initiate_return", {
        orderId: "ORDER-1",
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
      })
    ).resolves.toEqual({ return: { id: "ret_1" } });
    expect(client.discover).toHaveBeenCalled();
    expect(client.lookupOrder).toHaveBeenCalledWith({ orderId: "ORDER-1" });
    expect(client.listReturns).toHaveBeenCalledWith({ status: "initiated" });
    expect(client.initiateReturn).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "ORDER-1", requestedResolution: "refund" })
    );
  });

  it("dispatches mutation and webhook tools with ids stripped from payloads", async () => {
    const client = {
      updateReturn: vi.fn().mockResolvedValue({ return: { id: "ret_1", status: "approved" } }),
      selectExchange: vi.fn().mockResolvedValue({ return: { id: "ret_1" } }),
      selectCarrier: vi.fn().mockResolvedValue({ return: { id: "ret_1" } }),
      getLabel: vi.fn().mockResolvedValue({ label: { id: "label_1" } }),
      trackReturn: vi.fn().mockResolvedValue({ return: { id: "ret_1" } }),
      getReturnEvents: vi.fn().mockResolvedValue({ events: [] }),
      receiveWebhook: vi.fn().mockResolvedValue({ accepted: true, return: null })
    };

    await callTool(client as unknown as OpenReturnApiClient, "update_return", {
      id: "ret_1",
      status: "approved"
    });
    await callTool(client as unknown as OpenReturnApiClient, "select_exchange", {
      id: "ret_1",
      requestedItems: [
        {
          originalOrderItemId: "line_1",
          replacementSku: "SKU-L",
          replacementName: "Item large",
          quantity: 1
        }
      ]
    });
    await callTool(client as unknown as OpenReturnApiClient, "select_carrier", {
      id: "ret_1",
      carrier: "postnl"
    });
    await callTool(client as unknown as OpenReturnApiClient, "get_label", { id: "ret_1" });
    await callTool(client as unknown as OpenReturnApiClient, "track_return", {
      id: "ret_1",
      status: "accepted"
    });
    await callTool(client as unknown as OpenReturnApiClient, "get_return_events", { id: "ret_1" });
    await callTool(client as unknown as OpenReturnApiClient, "receive_webhook", {
      source: "postnl",
      type: "parcel.accepted",
      data: { status: "accepted" }
    });

    expect(client.updateReturn).toHaveBeenCalledWith("ret_1", { status: "approved" });
    expect(client.selectExchange).toHaveBeenCalledWith("ret_1", {
      requestedItems: [
        {
          originalOrderItemId: "line_1",
          replacementSku: "SKU-L",
          replacementName: "Item large",
          quantity: 1
        }
      ]
    });
    expect(client.selectCarrier).toHaveBeenCalledWith("ret_1", { carrier: "postnl" });
    expect(client.getLabel).toHaveBeenCalledWith("ret_1");
    expect(client.trackReturn).toHaveBeenCalledWith("ret_1", { status: "accepted" });
    expect(client.getReturnEvents).toHaveBeenCalledWith("ret_1");
    expect(client.receiveWebhook).toHaveBeenCalledWith({
      source: "postnl",
      type: "parcel.accepted",
      data: { status: "accepted" }
    });
  });
});
