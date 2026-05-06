import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

describe("OpenReturn API", () => {
  const app = createApp({
    config: {
      nodeEnv: "test",
      port: 0,
      apiBaseUrl: "http://localhost:4000",
      portalBaseUrl: "http://localhost:3000",
      oauthIssuer: "http://localhost:4000",
      oauthAudience: "openreturn-api",
      oauthTokenSecret: "test-secret-with-enough-length",
      requireAuth: false,
      smtp: { port: 1025, from: "returns@example.com" }
    }
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
