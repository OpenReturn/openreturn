import { afterEach, describe, expect, it } from "vitest";
import { ConfigValidationError, loadConfig } from "../src/config";

const originalEnv = { ...process.env };

afterEach(() => {
  clearEnv();
  Object.assign(process.env, originalEnv);
});

describe("API environment validation", () => {
  it("loads development defaults", () => {
    clearEnv();
    process.env.NODE_ENV = "test";

    const config = loadConfig();

    expect(config.port).toBe(4000);
    expect(config.adapters.carrierApiKeys.postnl).toBe("mock");
  });

  it("rejects invalid booleans and weak auth secrets", () => {
    clearEnv();
    process.env.NODE_ENV = "production";
    process.env.OPENRETURN_REQUIRE_AUTH = "yes";
    process.env.OAUTH_TOKEN_SECRET = "short";

    expect(() => loadConfig()).toThrow(ConfigValidationError);
  });
});

function clearEnv(): void {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
}
