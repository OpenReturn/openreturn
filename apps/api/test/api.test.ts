import { describe, expect, it } from "vitest";
import request from "supertest";
import type { ApiConfig } from "../src/config";
import { createApp } from "../src/app";

function testConfig(overrides: Partial<ApiConfig> = {}): ApiConfig {
  return {
    nodeEnv: "test",
    port: 0,
    apiBaseUrl: "http://localhost:4000",
    portalBaseUrl: "http://localhost:3000",
    oauthIssuer: "http://localhost:4000",
    oauthAudience: "openreturn-api",
    oauthTokenSecret: "test-secret-with-enough-length-123456",
    requireAuth: false,
    smtp: { port: 1025, from: "returns@example.com" },
    adapters: {
      carrierApiKeys: {
        postnl: "mock",
        dhl: "mock",
        ups: "mock",
        dpd: "mock",
        budbee: "mock"
      },
      platformApiKey: "mock",
      genericCommerceApiKey: "mock",
      stripeSecretKey: "mock"
    },
    ...overrides
  };
}

describe("OpenReturn API", () => {
  const app = createApp({
    config: testConfig()
  });

  it("returns discovery metadata", async () => {
    const response = await request(app).get("/.well-known/openreturn").expect(200);
    expect(response.body.capabilities.carriers).toContain("postnl");
    expect(response.body.mcp.tools).toContain("initiate_return");
  });

  it("creates, labels, tracks, and exposes events for a return", async () => {
    const created = await request(app)
      .post("/returns")
      .send({
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
      .expect(201);

    const id = created.body.return.id as string;
    await request(app).post(`/returns/${id}/carrier`).send({ carrier: "postnl" }).expect(200);
    const tracked = await request(app).post(`/returns/${id}/track`).send({ status: "accepted" }).expect(200);
    const events = await request(app).get(`/returns/${id}/events`).expect(200);

    expect(tracked.body.return.status).toBe("shipped");
    expect(events.body.events.length).toBeGreaterThan(1);
  });

  it("rejects invalid return payloads with structured validation details", async () => {
    const response = await request(app)
      .post("/returns")
      .send({
        orderId: "",
        customer: { email: "" },
        requestedResolution: "cash",
        items: [{ quantity: 0, reason: { code: "bad" } }]
      })
      .expect(400);

    expect(response.body.error.code).toBe("validation_error");
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "$.requestedResolution" })])
    );
  });

  it("runs an exchange flow and handles carrier webhooks by tracking number", async () => {
    const created = await request(app)
      .post("/returns")
      .send({
        orderId: "ORDER-EXCHANGE",
        customer: { email: "exchange@example.com" },
        requestedResolution: "exchange",
        items: [
          {
            orderItemId: "line_1",
            sku: "SKU-M",
            name: "Item medium",
            quantity: 1,
            reason: { code: "size" }
          }
        ]
      })
      .expect(201);
    const id = created.body.return.id as string;

    await request(app).post(`/returns/${id}/carrier`).send({ carrier: "dhl" }).expect(400);
    await request(app)
      .post(`/returns/${id}/exchange`)
      .send({
        requestedItems: [
          {
            originalOrderItemId: "line_1",
            replacementSku: "SKU-L",
            replacementName: "Item large",
            quantity: 1
          }
        ]
      })
      .expect(200);
    const labeled = await request(app)
      .post(`/returns/${id}/carrier`)
      .send({ carrier: "dhl", serviceLevel: "parcelshop" })
      .expect(200);
    const trackingNumber = labeled.body.return.label.trackingNumber as string;
    const webhook = await request(app)
      .post("/webhooks")
      .send({
        source: "dhl",
        type: "parcel.delivered",
        trackingNumber,
        data: { status: "delivered" }
      })
      .expect(202);

    expect(webhook.body.return.status).toBe("delivered");
  });

  it("enforces bearer scopes when auth is required", async () => {
    const authedApp = createApp({ config: testConfig({ requireAuth: true }) });
    await request(authedApp).get("/returns").expect(401);
    const token = await request(authedApp)
      .post("/oauth/token")
      .send({ client_id: "reader", scope: "returns:read" })
      .expect(200);

    await request(authedApp)
      .post("/returns")
      .set("authorization", `Bearer ${token.body.access_token}`)
      .send({})
      .expect(403);
  });

  it("issues and delegates OAuth tokens", async () => {
    const subject = await request(app).post("/oauth/token").send({ client_id: "consumer" }).expect(200);
    const agent = await request(app)
      .post("/oauth/token")
      .send({ client_id: "agent", scope: "agent:delegate returns:read" })
      .expect(200);
    const delegated = await request(app)
      .post("/oauth/delegate")
      .set("authorization", `Bearer ${agent.body.access_token}`)
      .send({ subjectToken: subject.body.access_token, actor: "agent", scope: "returns:read" })
      .expect(200);

    expect(delegated.body.access_token).toEqual(expect.any(String));
    expect(delegated.body.delegated_subject).toBe("consumer");
  });
});
