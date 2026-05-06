import {
  CARRIER_CODES,
  RESOLUTION_TYPES,
  RETURN_REASON_CODES,
  RETURN_STATES,
  TRACKING_STATUSES,
  assertAddTrackingRequest,
  assertInitiateReturnRequest,
  assertListReturnsRequest,
  assertLookupOrderRequest,
  assertReturnIdRequest,
  assertSelectCarrierRequest,
  assertSelectExchangeRequest,
  assertUpdateReturnRequest,
  assertWebhookEvent
} from "@openreturn/types";
import type { OpenReturnApiClient } from "./api-client";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

const emptySchema = {
  type: "object",
  properties: {},
  additionalProperties: false
};

const returnIdSchema = {
  type: "object",
  required: ["id"],
  properties: {
    id: { type: "string", description: "OpenReturn return id." }
  },
  additionalProperties: false
};

const returnItemSchema = {
  type: "object",
  required: ["orderItemId", "sku", "name", "quantity", "reason"],
  properties: {
    orderItemId: { type: "string" },
    sku: { type: "string" },
    name: { type: "string" },
    quantity: { type: "integer", minimum: 1 },
    reason: {
      type: "object",
      required: ["code"],
      properties: {
        code: { type: "string", enum: [...RETURN_REASON_CODES] },
        note: { type: "string" },
        evidenceUrls: { type: "array", items: { type: "string" } }
      }
    },
    condition: { type: "string", enum: ["unopened", "new", "used", "defective", "damaged"] }
  }
};

export const tools: McpToolDefinition[] = [
  {
    name: "discover_openreturn",
    description: "Read the retailer OpenReturn discovery document and advertised capabilities.",
    inputSchema: emptySchema
  },
  {
    name: "lookup_order",
    description: "Lookup an order through the configured commerce adapter before initiating a return.",
    inputSchema: {
      type: "object",
      required: ["orderId"],
      properties: {
        orderId: { type: "string" },
        email: { type: "string" }
      },
      additionalProperties: false
    }
  },
  {
    name: "list_returns",
    description: "List OpenReturn records, optionally filtered by status, customer email, and limit.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: [...RETURN_STATES] },
        email: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 500 }
      },
      additionalProperties: false
    }
  },
  {
    name: "initiate_return",
    description: "Initiate an OpenReturn request through the REST API.",
    inputSchema: {
      type: "object",
      required: ["orderId", "customer", "items", "requestedResolution"],
      properties: {
        orderId: { type: "string" },
        externalOrderId: { type: "string" },
        customer: {
          type: "object",
          required: ["email"],
          properties: {
            id: { type: "string" },
            email: { type: "string" },
            name: { type: "string" },
            phone: { type: "string" }
          }
        },
        items: { type: "array", minItems: 1, items: returnItemSchema },
        requestedResolution: {
          type: "string",
          enum: [...RESOLUTION_TYPES]
        },
        returnMethod: { type: "string" },
        metadata: { type: "object" }
      }
    }
  },
  {
    name: "get_return_status",
    description: "Get an OpenReturn status and full record by return id.",
    inputSchema: returnIdSchema
  },
  {
    name: "update_return",
    description: "Move a return through allowed lifecycle states or attach inspection/resolution data.",
    inputSchema: {
      type: "object",
      required: ["id"],
      minProperties: 2,
      properties: {
        id: { type: "string" },
        status: { type: "string", enum: [...RETURN_STATES] },
        inspection: { type: "object" },
        refund: { type: "object" },
        storeCredit: { type: "object" },
        couponCode: { type: "object" },
        metadata: { type: "object" }
      },
      additionalProperties: false
    }
  },
  {
    name: "select_exchange",
    description: "Select replacement items for an exchange return.",
    inputSchema: {
      type: "object",
      required: ["id", "requestedItems"],
      properties: {
        id: { type: "string" },
        requestedItems: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            required: ["originalOrderItemId", "replacementSku", "replacementName", "quantity"],
            properties: {
              originalOrderItemId: { type: "string" },
              replacementSku: { type: "string" },
              replacementName: { type: "string" },
              quantity: { type: "integer", minimum: 1 },
              attributes: { type: "object" },
              priceDifference: { type: "object" }
            }
          }
        }
      },
      additionalProperties: false
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
        carrier: { type: "string", enum: [...CARRIER_CODES] },
        serviceLevel: { type: "string" },
        dropoffPointId: { type: "string" },
        pickupWindow: { type: "object" },
        shipFrom: { type: "object" },
        shipTo: { type: "object" }
      },
      additionalProperties: false
    }
  },
  {
    name: "get_label",
    description: "Retrieve a generated shipping label for a return.",
    inputSchema: returnIdSchema
  },
  {
    name: "track_return",
    description: "Add a carrier tracking event to an OpenReturn.",
    inputSchema: {
      type: "object",
      required: ["id", "status"],
      properties: {
        id: { type: "string" },
        trackingNumber: { type: "string" },
        status: {
          type: "string",
          enum: [...TRACKING_STATUSES]
        },
        occurredAt: { type: "string" },
        location: { type: "string" },
        description: { type: "string" }
      },
      additionalProperties: false
    }
  },
  {
    name: "get_return_events",
    description: "Get the event history for a return.",
    inputSchema: returnIdSchema
  },
  {
    name: "receive_webhook",
    description: "Submit a carrier or commerce webhook event to the OpenReturn API.",
    inputSchema: {
      type: "object",
      required: ["source", "type", "data"],
      properties: {
        id: { type: "string" },
        source: { type: "string" },
        type: { type: "string" },
        returnId: { type: "string" },
        trackingNumber: { type: "string" },
        data: { type: "object" },
        occurredAt: { type: "string" }
      },
      additionalProperties: false
    }
  }
];

export async function callTool(
  client: OpenReturnApiClient,
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case "discover_openreturn":
      return client.discover();
    case "lookup_order":
      assertLookupOrderRequest(args);
      return client.lookupOrder(args);
    case "list_returns":
      assertListReturnsRequest(args);
      return client.listReturns(args);
    case "initiate_return":
      assertInitiateReturnRequest(args);
      return client.initiateReturn(args);
    case "get_return_status":
      assertReturnIdRequest(args);
      return client.getReturnStatus(args.id);
    case "update_return": {
      assertReturnIdRequest(args);
      const input = omitId(args);
      assertUpdateReturnRequest(input);
      return client.updateReturn(args.id, input);
    }
    case "select_exchange":
      assertReturnIdRequest(args);
      assertSelectExchangeRequest(args);
      return client.selectExchange(args.id, { requestedItems: args.requestedItems });
    case "select_carrier": {
      assertReturnIdRequest(args);
      const input = omitId(args);
      assertSelectCarrierRequest(input);
      return client.selectCarrier(args.id, input);
    }
    case "get_label":
      assertReturnIdRequest(args);
      return client.getLabel(args.id);
    case "track_return": {
      assertReturnIdRequest(args);
      const input = omitId(args);
      assertAddTrackingRequest(input);
      return client.trackReturn(args.id, input);
    }
    case "get_return_events":
      assertReturnIdRequest(args);
      return client.getReturnEvents(args.id);
    case "receive_webhook":
      assertWebhookEvent(args);
      return client.receiveWebhook(args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

function omitId(args: Record<string, unknown>): Record<string, unknown> {
  const input = { ...args };
  delete input.id;
  return input;
}
