import "dotenv/config";
import type { CarrierCode } from "@openreturn/types";

/** Runtime configuration for the OpenReturn REST API. */
export interface ApiConfig {
  nodeEnv: string;
  port: number;
  databaseUrl?: string;
  apiBaseUrl: string;
  portalBaseUrl: string;
  mcpUrl?: string;
  oauthIssuer: string;
  oauthAudience: string;
  oauthTokenSecret: string;
  requireAuth: boolean;
  smtp: {
    host?: string;
    port: number;
    user?: string;
    pass?: string;
    from: string;
  };
  adapters: {
    carrierApiKeys: Record<CarrierCode, string>;
    platformApiKey: string;
    genericCommerceApiKey: string;
    stripeSecretKey: string;
  };
}

/** Raised when environment variables cannot produce a safe API configuration. */
export class ConfigValidationError extends Error {
  public constructor(public readonly issues: string[]) {
    super(`Invalid environment configuration: ${issues.join("; ")}`);
    this.name = "ConfigValidationError";
  }
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

/** Loads and validates API configuration from environment variables. */
export function loadConfig(): ApiConfig {
  const issues: string[] = [];
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const apiBaseUrl = parseUrl("OPENRETURN_API_BASE_URL", "http://localhost:4000", issues);
  const portalBaseUrl = parseUrl("OPENRETURN_PORTAL_BASE_URL", "http://localhost:3000", issues);
  const mcpUrl = parseOptionalUrl("OPENRETURN_MCP_URL", issues);
  const oauthIssuer = parseUrl("OAUTH_ISSUER", apiBaseUrl, issues);
  const port = parseInteger("PORT", 4000, issues);
  const smtpPort = parseInteger("SMTP_PORT", 587, issues);
  const requireAuth = parseBoolean("OPENRETURN_REQUIRE_AUTH", false, issues);
  const oauthTokenSecret =
    process.env.OAUTH_TOKEN_SECRET ?? "development-secret-change-before-production";
  if ((nodeEnv === "production" || requireAuth) && oauthTokenSecret.length < 32) {
    issues.push("OAUTH_TOKEN_SECRET must be at least 32 characters when auth or production mode is enabled");
  }
  if (nodeEnv === "production" && oauthTokenSecret.startsWith("development-")) {
    issues.push("OAUTH_TOKEN_SECRET must not use the development default in production");
  }

  if (issues.length > 0) {
    throw new ConfigValidationError(issues);
  }

  return {
    nodeEnv,
    port,
    databaseUrl: optionalEnv("DATABASE_URL"),
    apiBaseUrl,
    portalBaseUrl,
    mcpUrl,
    oauthIssuer,
    oauthAudience: process.env.OAUTH_AUDIENCE ?? "openreturn-api",
    oauthTokenSecret,
    requireAuth,
    smtp: {
      host: optionalEnv("SMTP_HOST"),
      port: smtpPort,
      user: optionalEnv("SMTP_USER"),
      pass: optionalEnv("SMTP_PASS"),
      from: process.env.SMTP_FROM ?? "returns@example.com"
    },
    adapters: {
      carrierApiKeys: {
        postnl: process.env.POSTNL_API_KEY ?? "mock",
        dhl: process.env.DHL_API_KEY ?? "mock",
        ups: process.env.UPS_API_KEY ?? "mock",
        dpd: process.env.DPD_API_KEY ?? "mock",
        budbee: process.env.BUDBEE_API_KEY ?? "mock"
      },
      platformApiKey: process.env.PLATFORM_API_KEY ?? "mock",
      genericCommerceApiKey: process.env.GENERIC_COMMERCE_API_KEY ?? "mock",
      stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "mock"
    }
  };
}

function parseInteger(name: string, fallback: number, issues: string[]): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    issues.push(`${name} must be a non-negative integer`);
    return fallback;
  }
  return parsed;
}

function parseBoolean(name: string, fallback: boolean, issues: string[]): boolean {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  issues.push(`${name} must be either true or false`);
  return fallback;
}

function parseUrl(name: string, fallback: string, issues: string[]): string {
  const value = process.env[name] ?? fallback;
  try {
    new URL(value);
    return value;
  } catch {
    issues.push(`${name} must be an absolute URL`);
    return fallback;
  }
}

function parseOptionalUrl(name: string, issues: string[]): string | undefined {
  const value = optionalEnv(name);
  if (!value) {
    return undefined;
  }
  try {
    new URL(value);
    return value;
  } catch {
    issues.push(`${name} must be an absolute URL`);
    return undefined;
  }
}

/** Resolves the configured API key for a built-in carrier. */
export function carrierApiKey(config: ApiConfig, carrier: CarrierCode): string {
  return config.adapters.carrierApiKeys[carrier];
}
