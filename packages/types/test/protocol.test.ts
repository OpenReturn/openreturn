import { describe, expect, it } from "vitest";
import {
  assertAddTrackingRequest,
  assertInitiateReturnRequest,
  assertListReturnsRequest,
  assertSelectCarrierRequest,
  assertSelectExchangeRequest,
  assertTokenDelegationRequest,
  assertUpdateReturnRequest,
  assertWebhookEvent,
  CARRIER_CODES,
  ProtocolValidationError,
  RESOLUTION_TYPES,
  RETURN_REASON_CODES,
  RETURN_STATES,
  type OpenReturnDiscoveryDocument
} from "../src";

describe("OpenReturn protocol constants", () => {
  it("exposes the required lifecycle states", () => {
    expect(RETURN_STATES).toEqual([
      "initiated",
      "label_generated",
      "shipped",
      "in_transit",
      "delivered",
      "inspection",
      "approved",
      "rejected",
      "refunded",
      "exchanged",
      "completed"
    ]);
  });

  it("exposes reason, resolution, and carrier enumerations", () => {
    expect(RETURN_REASON_CODES).toContain("not_as_described");
    expect(RESOLUTION_TYPES).toContain("store_credit");
    expect(CARRIER_CODES).toEqual(["postnl", "dhl", "ups", "dpd", "budbee"]);
  });

  it("types the discovery document", () => {
    const document: OpenReturnDiscoveryDocument = {
      protocol: "openreturn",
      protocolVersion: "0.1.0",
      apiBaseUrl: "https://returns.example.com",
      oauth: {
        issuer: "https://returns.example.com",
        tokenEndpoint: "https://returns.example.com/oauth/token",
        delegationEndpoint: "https://returns.example.com/oauth/delegate",
        scopesSupported: ["returns:read"]
      },
      capabilities: {
        states: [...RETURN_STATES],
        reasonCodes: [...RETURN_REASON_CODES],
        resolutionTypes: [...RESOLUTION_TYPES],
        carriers: [...CARRIER_CODES],
        returnMethods: ["return-to-warehouse", "exchange"],
        labelFormats: ["pdf"],
        webhooks: true
      }
    };

    expect(document.protocol).toBe("openreturn");
  });

  it("validates initiate return requests at protocol boundaries", () => {
    const request: unknown = {
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
    };

    expect(() => assertInitiateReturnRequest(request)).not.toThrow();
  });

  it("reports structured validation issues", () => {
    expect(() =>
      assertInitiateReturnRequest({
        orderId: "",
        customer: { email: "" },
        requestedResolution: "cash",
        items: [{ quantity: 0, reason: { code: "not-a-reason" } }]
      })
    ).toThrow(ProtocolValidationError);
  });

  it("validates tracking statuses", () => {
    expect(() => assertAddTrackingRequest({ status: "accepted" })).not.toThrow();
    expect(() => assertAddTrackingRequest({ status: "waiting" })).toThrow(ProtocolValidationError);
  });

  it("validates list, exchange, carrier, webhook, and delegation request boundaries", () => {
    expect(() => assertListReturnsRequest({ status: "approved", limit: 25 })).not.toThrow();
    expect(() => assertListReturnsRequest({ limit: 501 })).toThrow(ProtocolValidationError);
    expect(() =>
      assertSelectExchangeRequest({
        requestedItems: [
          {
            originalOrderItemId: "line_1",
            replacementSku: "SKU-L",
            replacementName: "Item large",
            quantity: 1
          }
        ]
      })
    ).not.toThrow();
    expect(() => assertSelectExchangeRequest({ requestedItems: [] })).toThrow(
      ProtocolValidationError
    );
    expect(() => assertSelectCarrierRequest({ carrier: "postnl" })).not.toThrow();
    expect(() => assertSelectCarrierRequest({ carrier: "" })).toThrow(ProtocolValidationError);
    expect(() =>
      assertWebhookEvent({ source: "postnl", type: "parcel.accepted", data: {} })
    ).not.toThrow();
    expect(() =>
      assertTokenDelegationRequest({
        subjectToken: "token",
        actor: "agent",
        scope: "returns:read"
      })
    ).not.toThrow();
  });

  it("rejects empty update requests", () => {
    expect(() => assertUpdateReturnRequest({})).toThrow(ProtocolValidationError);
    expect(() => assertUpdateReturnRequest({ status: "approved" })).not.toThrow();
  });

  it("validates structured resolution update payloads", () => {
    expect(() =>
      assertUpdateReturnRequest({
        status: "refunded",
        refund: {
          amount: { amount: 1000, currency: "EUR" },
          provider: "stripe",
          transactionId: "re_123",
          processedAt: new Date().toISOString()
        }
      })
    ).not.toThrow();
    expect(() =>
      assertUpdateReturnRequest({
        status: "completed",
        storeCredit: { amount: { amount: 1000, currency: "eur" }, issuedAt: "now" }
      })
    ).toThrow(ProtocolValidationError);
    expect(() =>
      assertUpdateReturnRequest({
        status: "completed",
        couponCode: {
          code: "COUPON",
          percentage: 150,
          issuedAt: new Date().toISOString()
        }
      })
    ).toThrow(ProtocolValidationError);
  });
});
