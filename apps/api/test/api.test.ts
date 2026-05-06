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

function createTestApp(overrides: Partial<ApiConfig> = {}) {
  return createApp({
    config: testConfig(overrides)
  });
}

describe("OpenReturn API", () => {
  it("returns discovery metadata", async () => {
    const app = createTestApp();
    await request(app).get("/healthz").expect(200, { ok: true });
    const response = await request(app).get("/.well-known/openreturn").expect(200);
    const oauthMetadata = await request(app)
      .get("/.well-known/oauth-authorization-server")
      .expect(200);
    const openApi = await request(app).get("/openapi.json").expect(200);

    expect(response.body.capabilities.carriers).toContain("postnl");
    expect(response.body.mcp.tools).toContain("initiate_return");
    expect(oauthMetadata.body.token_endpoint).toBe("http://localhost:4000/oauth/token");
    expect(openApi.body.paths["/returns/{id}/track"]).toBeDefined();
  });

  it("looks up orders and reports missing orders", async () => {
    const app = createTestApp();
    const found = await request(app)
      .get("/orders/ORDER-LOOKUP")
      .query({ email: "Customer@Example.com" })
      .expect(200);

    await request(app).get("/orders/MISSING-LOOKUP").expect(404);
    expect(found.body.order.customer.email).toBe("customer@example.com");
  });

  it("creates, labels, tracks, and exposes events for a return", async () => {
    const app = createTestApp();
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
    const labeled = await request(app)
      .post(`/returns/${id}/carrier`)
      .send({ carrier: "postnl", serviceLevel: "standard" })
      .expect(200);
    const labelUrl = new URL(labeled.body.return.label.labelUrl as string);
    const labelPath = `${labelUrl.pathname}`;
    await request(app).get(labelPath).expect(200).expect("content-type", /application\/pdf/);
    await request(app).get(`/returns/${id}/label`).expect(200);
    const tracked = await request(app).post(`/returns/${id}/track`).send({ status: "accepted" }).expect(200);
    const listed = await request(app).get("/returns").query({ status: "shipped", limit: 10 }).expect(200);
    const events = await request(app).get(`/returns/${id}/events`).expect(200);

    expect(tracked.body.return.status).toBe("shipped");
    expect(listed.body.returns).toEqual(
      expect.arrayContaining([expect.objectContaining({ id, status: "shipped" })])
    );
    expect(events.body.events.length).toBeGreaterThan(1);
  });

  it("rejects invalid return payloads with structured validation details", async () => {
    const app = createTestApp();
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

  it("validates filters, lifecycle payloads, labels, and completion results", async () => {
    const app = createTestApp();
    await request(app).get("/returns").query({ status: "lost" }).expect(400);

    const created = await request(app)
      .post("/returns")
      .send({
        orderId: "ORDER-LIFECYCLE",
        customer: { email: "lifecycle@example.com" },
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
      })
      .expect(201);
    const id = created.body.return.id as string;

    await request(app).get(`/returns/${id}/label`).expect(404);
    await request(app).put(`/returns/${id}`).send({ status: "approved" }).expect(200);
    await request(app).put(`/returns/${id}`).send({ status: "completed" }).expect(400);
    await request(app)
      .put(`/returns/${id}`)
      .send({
        status: "refunded",
        refund: {
          amount: { amount: 2999, currency: "EUR" },
          provider: "stripe",
          transactionId: "re_test",
          processedAt: new Date().toISOString()
        }
      })
      .expect(200);
    const completed = await request(app).put(`/returns/${id}`).send({ status: "completed" }).expect(200);

    expect(completed.body.return.status).toBe("completed");
  });

  it("completes store credit and coupon code returns with required resolution payloads", async () => {
    const app = createTestApp();
    const baseItem = {
      orderItemId: "line_1",
      sku: "SKU",
      name: "Item",
      quantity: 1,
      reason: { code: "other" }
    };
    const storeCredit = await request(app)
      .post("/returns")
      .send({
        orderId: "ORDER-CREDIT",
        customer: { email: "credit@example.com" },
        requestedResolution: "store_credit",
        items: [baseItem]
      })
      .expect(201);
    const coupon = await request(app)
      .post("/returns")
      .send({
        orderId: "ORDER-COUPON",
        customer: { email: "coupon@example.com" },
        requestedResolution: "coupon_code",
        items: [baseItem]
      })
      .expect(201);

    await request(app).put(`/returns/${storeCredit.body.return.id}`).send({ status: "approved" }).expect(200);
    await request(app).put(`/returns/${coupon.body.return.id}`).send({ status: "approved" }).expect(200);
    await request(app).put(`/returns/${storeCredit.body.return.id}`).send({ status: "completed" }).expect(400);
    await request(app).put(`/returns/${coupon.body.return.id}`).send({ status: "completed" }).expect(400);

    await request(app)
      .put(`/returns/${storeCredit.body.return.id}`)
      .send({
        status: "completed",
        storeCredit: {
          amount: { amount: 1000, currency: "EUR" },
          code: "CREDIT-TEST",
          issuedAt: new Date().toISOString()
        }
      })
      .expect(200);
    await request(app)
      .put(`/returns/${coupon.body.return.id}`)
      .send({
        status: "completed",
        couponCode: {
          code: "COUPON-TEST",
          percentage: 10,
          issuedAt: new Date().toISOString()
        }
      })
      .expect(200);
  });

  it("runs an exchange flow and handles carrier webhooks by tracking number", async () => {
    const app = createTestApp();
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
    const authedApp = createTestApp({ requireAuth: true });
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
    const app = createTestApp();
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

  it("accepts unmatched webhooks and reports missing platform adapters", async () => {
    const app = createTestApp();
    const noAdapterApp = createApp({
      config: testConfig(),
      platformAdapters: [],
      genericAdapters: []
    });

    const unmatched = await request(app)
      .post("/webhooks")
      .send({
        source: "carrier",
        type: "parcel.delivered",
        trackingNumber: "UNKNOWN",
        data: { status: "delivered" }
      })
      .expect(202);
    await request(noAdapterApp).get("/orders/ORDER-1").expect(503);

    expect(unmatched.body).toEqual({ accepted: true, return: null });
  });
});
