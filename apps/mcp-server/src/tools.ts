import type { OpenReturnApiClient } from "./api-client";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const tools: McpToolDefinition[] = [
  {
    name: "initiate_return",
    description: "Initiate an OpenReturn request through the REST API.",
    inputSchema: {
      type: "object",
      required: ["orderId", "customer", "items", "requestedResolution"],
      properties: {
        orderId: { type: "string" },
        externalOrderId: { type: "string" },
        customer: { type: "object" },
        items: { type: "array", items: { type: "object" } },
        requestedResolution: {
          type: "string",
          enum: ["refund", "exchange", "store_credit", "coupon_code"]
        },
        returnMethod: { type: "string" },
        metadata: { type: "object" }
      }
    }
  },
  {
    name: "get_return_status",
    description: "Get an OpenReturn status by return id.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string" } }
    }
  },
  {
    name: "select_exchange",
    description: "Select exchange items for an exchange return.",
    inputSchema: {
      type: "object",
      required: ["id", "requestedItems"],
      properties: {
        id: { type: "string" },
        requestedItems: { type: "array", items: { type: "object" } }
      }
    }
  },
  {
    name: "select_carrier",
    description: "Select a carrier and generate a return label.",
    inputSchema: {
      type: "object",
      required: ["id", "carrier"],
      properties: {
        id: { type: "string" },
        carrier: { type: "string", enum: ["postnl", "dhl", "ups", "dpd", "budbee"] },
        serviceLevel: { type: "string" },
        dropoffPointId: { type: "string" }
      }
    }
  },
  {
    name: "get_label",
    description: "Retrieve a generated shipping label.",
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: { id: { type: "string" } }
    }
  },
  {
    name: "track_return",
    description: "Add a tracking event to an OpenReturn.",
    inputSchema: {
      type: "object",
      required: ["id", "status"],
      properties: {
        id: { type: "string" },
        trackingNumber: { type: "string" },
        status: {
          type: "string",
          enum: ["label_created", "accepted", "in_transit", "out_for_delivery", "delivered", "exception"]
        },
        occurredAt: { type: "string" },
        location: { type: "string" },
        description: { type: "string" }
      }
    }
  }
];

export async function callTool(
  client: OpenReturnApiClient,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "initiate_return":
      return client.initiateReturn(args as any);
    case "get_return_status":
      return client.getReturnStatus(String(args.id));
    case "select_exchange":
      return client.selectExchange(String(args.id), { requestedItems: args.requestedItems as any[] });
    case "select_carrier": {
      const { id, ...input } = args;
      return client.selectCarrier(String(id), input as any);
    }
    case "get_label":
      return client.getLabel(String(args.id));
    case "track_return": {
      const { id, ...input } = args;
      return client.trackReturn(String(id), input as any);
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
