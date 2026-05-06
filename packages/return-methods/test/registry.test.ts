import { describe, expect, it } from "vitest";
import { createDefaultReturnMethodRegistry, ThirdPartyReturnMethod } from "../src";

describe("return method registry", () => {
  it("registers built-in and third-party methods", () => {
    const registry = createDefaultReturnMethodRegistry();
    registry.register(
      new ThirdPartyReturnMethod({
        id: "resale_partner",
        displayName: "Resale partner",
        description: "Routes eligible returns to resale.",
        supportedResolutions: ["store_credit"],
        requiresCarrier: false,
        thirdPartyProvider: "resale.example"
      })
    );

    expect(registry.list().map((method) => method.id)).toEqual([
      "return-to-warehouse",
      "exchange",
      "resale_partner"
    ]);
  });
});
