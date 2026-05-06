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

  it("normalizes URL settings before they are used for path concatenation", () => {
    clearEnv();
    process.env.NODE_ENV = "test";
    process.env.OPENRETURN_API_BASE_URL = "http://localhost:4000/";
    process.env.OPENRETURN_PORTAL_BASE_URL = "http://localhost:3000/";
    process.env.OPENRETURN_MCP_URL = "http://localhost:4100/mcp/";

    const config = loadConfig();

    expect(config.apiBaseUrl).toBe("http://localhost:4000");
    expect(config.portalBaseUrl).toBe("http://localhost:3000");
    expect(config.mcpUrl).toBe("http://localhost:4100/mcp");
  });
});

function clearEnv(): void {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
}
