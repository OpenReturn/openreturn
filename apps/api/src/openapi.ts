import {
  CARRIER_CODES,
  LABEL_FORMATS,
  RESOLUTION_TYPES,
  RETURN_ITEM_CONDITIONS,
  RETURN_REASON_CODES,
  RETURN_STATES,
  TRACKING_STATUSES
} from "@openreturn/types";

const errorResponse = {
  description: "Error response",
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" }
    }
  }
};

const json = (schema: Record<string, unknown>) => ({
  content: {
    "application/json": {
      schema
    }
  }
});

export const openApiDocument = {
  openapi: "3.1.0",
  info: {
    title: "OpenReturn API",
    version: "0.1.0",
    description: "Reference REST API for the OpenReturn protocol."
  },
  servers: [{ url: "http://localhost:4000" }],
  security: [{ bearerAuth: [] }],
  tags: [
    { name: "Discovery" },
    { name: "OAuth" },
    { name: "Orders" },
    { name: "Returns" },
    { name: "Webhooks" },
    { name: "Labels" }
  ],
  paths: {
    "/healthz": {
      get: {
        tags: ["Discovery"],
        summary: "Health check",
        security: [],
        responses: {
          "200": {
            description: "API is healthy",
            ...json({ type: "object", properties: { ok: { type: "boolean" } } })
          }
        }
      }
    },
    "/openapi.json": {
      get: {
        tags: ["Discovery"],
        summary: "Fetch the OpenAPI document",
        security: [],
        responses: { "200": { description: "OpenAPI document" } }
      }
    },
    "/.well-known/openreturn": {
      get: {
        tags: ["Discovery"],
        summary: "Discover OpenReturn capabilities",
        security: [],
        responses: {
          "200": {
            description: "Discovery document",
            ...json({ $ref: "#/components/schemas/OpenReturnDiscoveryDocument" })
          }
        }
      }
    },
    "/.well-known/oauth-authorization-server": {
      get: {
        tags: ["OAuth"],
        summary: "Discover OAuth authorization server metadata",
        security: [],
        responses: {
          "200": {
            description: "OAuth authorization server metadata",
            ...json({ type: "object", additionalProperties: true })
          }
        }
      }
    },
    "/oauth/token": {
      post: {
        tags: ["OAuth"],
        summary: "Issue OAuth 2.1 client credentials token",
        security: [],
        requestBody: {
          required: false,
          ...json({
            type: "object",
            properties: {
              client_id: { type: "string" },
              scope: { type: "string" }
            }
          })
        },
        responses: {
          "200": {
            description: "Token response",
            ...json({ $ref: "#/components/schemas/OAuthTokenResponse" })
          }
        }
      }
    },
    "/oauth/delegate": {
      post: {
        tags: ["OAuth"],
        summary: "Exchange a consumer subject token for a delegated agent token",
        requestBody: {
          required: true,
          ...json({ $ref: "#/components/schemas/TokenDelegationRequest" })
        },
        responses: {
          "200": {
            description: "Delegated token response",
            ...json({ $ref: "#/components/schemas/OAuthTokenResponse" })
          },
          "400": errorResponse,
          "401": errorResponse,
          "403": errorResponse
        }
      }
    },
    "/orders/{id}": {
      get: {
        tags: ["Orders"],
        summary: "Lookup an order through the configured platform adapter",
        parameters: [
          { $ref: "#/components/parameters/IdPath" },
          {
            name: "email",
            in: "query",
            required: false,
            schema: { type: "string", format: "email" }
          }
        ],
        responses: {
          "200": {
            description: "Order",
            ...json({
              type: "object",
              required: ["order"],
              properties: { order: { $ref: "#/components/schemas/Order" } }
            })
          },
          "404": errorResponse
        }
      }
    },
    "/returns": {
      get: {
        tags: ["Returns"],
        summary: "List returns",
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { $ref: "#/components/schemas/ReturnState" }
          },
          { name: "email", in: "query", schema: { type: "string", format: "email" } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 500 } }
        ],
        responses: {
          "200": {
            description: "Return list",
            ...json({
              type: "object",
              required: ["returns"],
              properties: {
                returns: {
                  type: "array",
                  items: { $ref: "#/components/schemas/OpenReturnRecord" }
                }
              }
            })
          },
          "400": errorResponse
        }
      },
      post: {
        tags: ["Returns"],
        summary: "Initiate return request",
        requestBody: {
          required: true,
          ...json({ $ref: "#/components/schemas/InitiateReturnRequest" })
        },
        responses: {
          "201": {
            description: "Return created",
            ...json({
              type: "object",
              required: ["return"],
              properties: { return: { $ref: "#/components/schemas/OpenReturnRecord" } }
            })
          },
          "400": errorResponse,
          "409": errorResponse
        }
      }
    },
    "/returns/{id}": {
      get: {
        tags: ["Returns"],
        summary: "Get return status",
        parameters: [{ $ref: "#/components/parameters/IdPath" }],
        responses: {
          "200": {
            description: "Return",
            ...json({
              type: "object",
              required: ["return"],
              properties: { return: { $ref: "#/components/schemas/OpenReturnRecord" } }
            })
          },
          "404": errorResponse
        }
      },
      put: {
        tags: ["Returns"],
        summary: "Update return lifecycle data",
        parameters: [{ $ref: "#/components/parameters/IdPath" }],
        requestBody: {
          required: true,
          ...json({ $ref: "#/components/schemas/UpdateReturnRequest" })
        },
        responses: {
          "200": {
            description: "Updated return",
            ...json({
              type: "object",
              required: ["return"],
              properties: { return: { $ref: "#/components/schemas/OpenReturnRecord" } }
            })
          },
          "400": errorResponse,
          "404": errorResponse,
          "409": errorResponse
        }
      }
    },
    "/returns/{id}/exchange": {
      post: {
        tags: ["Returns"],
        summary: "Select exchange products",
        parameters: [{ $ref: "#/components/parameters/IdPath" }],
        requestBody: {
          required: true,
          ...json({ $ref: "#/components/schemas/SelectExchangeRequest" })
        },
        responses: {
          "200": {
            description: "Updated return",
            ...json({
              type: "object",
              required: ["return"],
              properties: { return: { $ref: "#/components/schemas/OpenReturnRecord" } }
            })
          },
          "400": errorResponse,
          "409": errorResponse
        }
      }
    },
    "/returns/{id}/carrier": {
      post: {
        tags: ["Returns"],
        summary: "Select carrier and generate label",
        parameters: [{ $ref: "#/components/parameters/IdPath" }],
        requestBody: {
          required: true,
          ...json({ $ref: "#/components/schemas/SelectCarrierRequest" })
        },
        responses: {
          "200": {
            description: "Updated return with label",
            ...json({
              type: "object",
              required: ["return"],
              properties: { return: { $ref: "#/components/schemas/OpenReturnRecord" } }
            })
          },
          "400": errorResponse,
          "409": errorResponse
        }
      }
    },
    "/returns/{id}/label": {
      get: {
        tags: ["Labels"],
        summary: "Get shipping label metadata",
        parameters: [{ $ref: "#/components/parameters/IdPath" }],
        responses: {
          "200": {
            description: "Shipping label",
            ...json({
              type: "object",
              required: ["label"],
              properties: { label: { $ref: "#/components/schemas/ShippingLabel" } }
            })
          },
          "404": errorResponse
        }
      }
    },
    "/labels/{carrier}/{trackingNumber}": {
      get: {
        tags: ["Labels"],
        summary: "Download a mock label PDF",
        security: [],
        parameters: [
          { name: "carrier", in: "path", required: true, schema: { type: "string" } },
          { name: "trackingNumber", in: "path", required: true, schema: { type: "string" } }
        ],
        responses: {
          "200": {
            description: "PDF label",
            content: { "application/pdf": { schema: { type: "string", format: "binary" } } }
          }
        }
      }
    },
    "/returns/{id}/track": {
      post: {
        tags: ["Returns"],
        summary: "Add tracking update",
        parameters: [{ $ref: "#/components/parameters/IdPath" }],
        requestBody: {
          required: true,
          ...json({ $ref: "#/components/schemas/AddTrackingRequest" })
        },
        responses: {
          "200": {
            description: "Updated return",
            ...json({
              type: "object",
              required: ["return"],
              properties: { return: { $ref: "#/components/schemas/OpenReturnRecord" } }
            })
          },
          "400": errorResponse,
          "404": errorResponse,
          "409": errorResponse
        }
      }
    },
    "/returns/{id}/events": {
      get: {
        tags: ["Returns"],
        summary: "Get return event history",
        parameters: [{ $ref: "#/components/parameters/IdPath" }],
        responses: {
          "200": {
            description: "Return events",
            ...json({
              type: "object",
              required: ["events"],
              properties: {
                events: {
                  type: "array",
                  items: { $ref: "#/components/schemas/ReturnEvent" }
                }
              }
            })
          },
          "404": errorResponse
        }
      }
    },
    "/webhooks": {
      post: {
        tags: ["Webhooks"],
        summary: "Receive carrier or commerce webhook events",
        requestBody: {
          required: true,
          ...json({ $ref: "#/components/schemas/WebhookEvent" })
        },
        responses: {
          "202": {
            description: "Webhook accepted",
            ...json({
              type: "object",
              required: ["accepted"],
              properties: {
                accepted: { type: "boolean" },
                return: {
                  oneOf: [{ $ref: "#/components/schemas/OpenReturnRecord" }, { type: "null" }]
                }
              }
            })
          },
          "400": errorResponse
        }
      }
    }
  },
  components: {
    parameters: {
      IdPath: {
        name: "id",
        in: "path",
        required: true,
        schema: { type: "string" }
      }
    },
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT"
      }
    },
    schemas: {
      ReturnState: { type: "string", enum: [...RETURN_STATES] },
      ResolutionType: { type: "string", enum: [...RESOLUTION_TYPES] },
      ReasonCode: { type: "string", enum: [...RETURN_REASON_CODES] },
      CarrierCode: { type: "string", enum: [...CARRIER_CODES] },
      TrackingStatus: { type: "string", enum: [...TRACKING_STATUSES] },
      Money: {
        type: "object",
        required: ["amount", "currency"],
        properties: {
          amount: { type: "integer", description: "Minor units, for example cents." },
          currency: { type: "string", minLength: 3, maxLength: 3 }
        }
      },
      Address: {
        type: "object",
        required: ["line1", "city", "postalCode", "countryCode"],
        properties: {
          name: { type: "string" },
          line1: { type: "string" },
          line2: { type: "string" },
          city: { type: "string" },
          region: { type: "string" },
          postalCode: { type: "string" },
          countryCode: { type: "string", minLength: 2, maxLength: 2 }
        }
      },
      Customer: {
        type: "object",
        required: ["email"],
        properties: {
          id: { type: "string" },
          email: { type: "string", format: "email" },
          name: { type: "string" },
          phone: { type: "string" },
          shippingAddress: { $ref: "#/components/schemas/Address" }
        }
      },
      OrderItem: {
        type: "object",
        required: ["id", "sku", "name", "quantity", "unitPrice"],
        properties: {
          id: { type: "string" },
          sku: { type: "string" },
          name: { type: "string" },
          quantity: { type: "integer", minimum: 1 },
          unitPrice: { $ref: "#/components/schemas/Money" },
          imageUrl: { type: "string" },
          attributes: { type: "object", additionalProperties: { type: "string" } }
        }
      },
      Order: {
        type: "object",
        required: ["id", "customer", "items", "total", "placedAt"],
        properties: {
          id: { type: "string" },
          externalOrderId: { type: "string" },
          customer: { $ref: "#/components/schemas/Customer" },
          items: { type: "array", items: { $ref: "#/components/schemas/OrderItem" } },
          total: { $ref: "#/components/schemas/Money" },
          placedAt: { type: "string", format: "date-time" },
          platform: { type: "string" }
        }
      },
      ReturnReason: {
        type: "object",
        required: ["code"],
        properties: {
          code: { $ref: "#/components/schemas/ReasonCode" },
          note: { type: "string" },
          evidenceUrls: { type: "array", items: { type: "string", format: "uri" } }
        }
      },
      ReturnItem: {
        type: "object",
        required: ["orderItemId", "sku", "name", "quantity", "reason"],
        properties: {
          orderItemId: { type: "string" },
          sku: { type: "string" },
          name: { type: "string" },
          quantity: { type: "integer", minimum: 1 },
          reason: { $ref: "#/components/schemas/ReturnReason" },
          condition: { type: "string", enum: [...RETURN_ITEM_CONDITIONS] }
        }
      },
      ExchangeItem: {
        type: "object",
        required: ["originalOrderItemId", "replacementSku", "replacementName", "quantity"],
        properties: {
          originalOrderItemId: { type: "string" },
          replacementSku: { type: "string" },
          replacementName: { type: "string" },
          quantity: { type: "integer", minimum: 1 },
          attributes: { type: "object", additionalProperties: { type: "string" } },
          priceDifference: { $ref: "#/components/schemas/Money" }
        }
      },
      ExchangeSelection: {
        type: "object",
        required: ["requestedItems", "selectedAt", "status"],
        properties: {
          requestedItems: { type: "array", items: { $ref: "#/components/schemas/ExchangeItem" } },
          selectedAt: { type: "string", format: "date-time" },
          status: { type: "string", enum: ["pending", "reserved", "fulfilled", "cancelled"] }
        }
      },
      SelectExchangeRequest: {
        type: "object",
        required: ["requestedItems"],
        properties: {
          requestedItems: { type: "array", items: { $ref: "#/components/schemas/ExchangeItem" } }
        }
      },
      SelectCarrierRequest: {
        type: "object",
        required: ["carrier"],
        properties: {
          carrier: { type: "string" },
          serviceLevel: { type: "string" },
          dropoffPointId: { type: "string" },
          pickupWindow: {
            type: "object",
            required: ["startsAt", "endsAt"],
            properties: {
              startsAt: { type: "string", format: "date-time" },
              endsAt: { type: "string", format: "date-time" }
            }
          },
          shipFrom: { $ref: "#/components/schemas/Address" },
          shipTo: { $ref: "#/components/schemas/Address" }
        }
      },
      ShippingLabel: {
        type: "object",
        required: ["id", "carrier", "trackingNumber", "labelUrl", "format", "expiresAt", "createdAt"],
        properties: {
          id: { type: "string" },
          carrier: { type: "string" },
          trackingNumber: { type: "string" },
          labelUrl: { type: "string", format: "uri" },
          format: { type: "string", enum: [...LABEL_FORMATS] },
          expiresAt: { type: "string", format: "date-time" },
          createdAt: { type: "string", format: "date-time" }
        }
      },
      TrackingEvent: {
        type: "object",
        required: ["id", "carrier", "trackingNumber", "status", "occurredAt"],
        properties: {
          id: { type: "string" },
          carrier: { type: "string" },
          trackingNumber: { type: "string" },
          status: { $ref: "#/components/schemas/TrackingStatus" },
          occurredAt: { type: "string", format: "date-time" },
          location: { type: "string" },
          description: { type: "string" }
        }
      },
      InspectionResult: {
        type: "object",
        required: ["inspectedAt", "accepted"],
        properties: {
          inspectedAt: { type: "string", format: "date-time" },
          inspectorId: { type: "string" },
          accepted: { type: "boolean" },
          notes: { type: "string" },
          itemConditions: {
            type: "object",
            additionalProperties: { type: "string", enum: [...RETURN_ITEM_CONDITIONS] }
          }
        }
      },
      RefundResult: {
        type: "object",
        required: ["amount", "provider", "transactionId", "processedAt"],
        properties: {
          amount: { $ref: "#/components/schemas/Money" },
          provider: { type: "string" },
          transactionId: { type: "string" },
          processedAt: { type: "string", format: "date-time" }
        }
      },
      StoreCreditResult: {
        type: "object",
        required: ["amount", "code", "issuedAt"],
        properties: {
          amount: { $ref: "#/components/schemas/Money" },
          code: { type: "string" },
          expiresAt: { type: "string", format: "date-time" },
          issuedAt: { type: "string", format: "date-time" }
        }
      },
      CouponCodeResult: {
        type: "object",
        required: ["code", "issuedAt"],
        properties: {
          code: { type: "string" },
          amount: { $ref: "#/components/schemas/Money" },
          percentage: { type: "number" },
          expiresAt: { type: "string", format: "date-time" },
          issuedAt: { type: "string", format: "date-time" }
        }
      },
      ReturnEvent: {
        type: "object",
        required: ["id", "returnId", "type", "state", "message", "createdAt"],
        properties: {
          id: { type: "string" },
          returnId: { type: "string" },
          type: { type: "string" },
          state: { $ref: "#/components/schemas/ReturnState" },
          message: { type: "string" },
          data: { type: "object", additionalProperties: true },
          actor: { type: "string", enum: ["consumer", "retailer", "carrier", "system", "agent"] },
          createdAt: { type: "string", format: "date-time" }
        }
      },
      OpenReturnRecord: {
        type: "object",
        required: [
          "id",
          "orderId",
          "customer",
          "status",
          "requestedResolution",
          "reasonCodes",
          "items",
          "returnMethod",
          "tracking",
          "events",
          "createdAt",
          "updatedAt"
        ],
        properties: {
          id: { type: "string" },
          orderId: { type: "string" },
          externalOrderId: { type: "string" },
          customer: { $ref: "#/components/schemas/Customer" },
          status: { $ref: "#/components/schemas/ReturnState" },
          requestedResolution: { $ref: "#/components/schemas/ResolutionType" },
          reasonCodes: { type: "array", items: { $ref: "#/components/schemas/ReasonCode" } },
          items: { type: "array", items: { $ref: "#/components/schemas/ReturnItem" } },
          returnMethod: { type: "string" },
          exchange: { $ref: "#/components/schemas/ExchangeSelection" },
          carrier: { $ref: "#/components/schemas/SelectCarrierRequest" },
          label: { $ref: "#/components/schemas/ShippingLabel" },
          tracking: { type: "array", items: { $ref: "#/components/schemas/TrackingEvent" } },
          inspection: { $ref: "#/components/schemas/InspectionResult" },
          refund: { $ref: "#/components/schemas/RefundResult" },
          storeCredit: { $ref: "#/components/schemas/StoreCreditResult" },
          couponCode: { $ref: "#/components/schemas/CouponCodeResult" },
          metadata: { type: "object", additionalProperties: true },
          events: { type: "array", items: { $ref: "#/components/schemas/ReturnEvent" } },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          completedAt: { type: "string", format: "date-time" }
        }
      },
      InitiateReturnRequest: {
        type: "object",
        required: ["orderId", "customer", "items", "requestedResolution"],
        properties: {
          orderId: { type: "string" },
          externalOrderId: { type: "string" },
          customer: { $ref: "#/components/schemas/Customer" },
          items: { type: "array", minItems: 1, items: { $ref: "#/components/schemas/ReturnItem" } },
          requestedResolution: { $ref: "#/components/schemas/ResolutionType" },
          returnMethod: { type: "string" },
          metadata: { type: "object", additionalProperties: true }
        }
      },
      UpdateReturnRequest: {
        type: "object",
        minProperties: 1,
        properties: {
          status: { $ref: "#/components/schemas/ReturnState" },
          inspection: { $ref: "#/components/schemas/InspectionResult" },
          refund: { $ref: "#/components/schemas/RefundResult" },
          storeCredit: { $ref: "#/components/schemas/StoreCreditResult" },
          couponCode: { $ref: "#/components/schemas/CouponCodeResult" },
          metadata: { type: "object", additionalProperties: true }
        }
      },
      AddTrackingRequest: {
        type: "object",
        required: ["status"],
        properties: {
          trackingNumber: { type: "string" },
          status: { $ref: "#/components/schemas/TrackingStatus" },
          occurredAt: { type: "string", format: "date-time" },
          location: { type: "string" },
          description: { type: "string" }
        }
      },
      WebhookEvent: {
        type: "object",
        required: ["source", "type", "data"],
        properties: {
          id: { type: "string" },
          source: { type: "string" },
          type: { type: "string" },
          returnId: { type: "string" },
          trackingNumber: { type: "string" },
          data: { type: "object", additionalProperties: true },
          occurredAt: { type: "string", format: "date-time" }
        }
      },
      TokenDelegationRequest: {
        type: "object",
        required: ["subjectToken", "actor", "scope"],
        properties: {
          subjectToken: { type: "string" },
          actor: { type: "string" },
          scope: { type: "string" },
          audience: { type: "string" }
        }
      },
      OAuthTokenResponse: {
        type: "object",
        required: ["access_token", "token_type", "expires_in", "scope"],
        properties: {
          access_token: { type: "string" },
          token_type: { type: "string", enum: ["Bearer"] },
          expires_in: { type: "integer" },
          scope: { type: "string" },
          delegated_subject: { type: "string" }
        }
      },
      OpenReturnDiscoveryDocument: {
        type: "object",
        required: ["protocol", "protocolVersion", "apiBaseUrl", "oauth", "capabilities"],
        properties: {
          protocol: { type: "string", enum: ["openreturn"] },
          protocolVersion: { type: "string" },
          apiBaseUrl: { type: "string", format: "uri" },
          mcp: { type: "object", additionalProperties: true },
          oauth: { type: "object", additionalProperties: true },
          capabilities: { type: "object", additionalProperties: true }
        }
      },
      Error: {
        type: "object",
        required: ["error"],
        properties: {
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: { type: "string" },
              message: { type: "string" },
              details: {}
            }
          }
        }
      }
    }
  }
};
