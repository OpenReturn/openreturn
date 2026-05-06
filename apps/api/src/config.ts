import "dotenv/config";

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
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export function loadConfig(): ApiConfig {
  const apiBaseUrl = process.env.OPENRETURN_API_BASE_URL ?? "http://localhost:4000";
  return {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: Number(process.env.PORT ?? 4000),
    databaseUrl: optionalEnv("DATABASE_URL"),
    apiBaseUrl,
    portalBaseUrl: process.env.OPENRETURN_PORTAL_BASE_URL ?? "http://localhost:3000",
    mcpUrl: optionalEnv("OPENRETURN_MCP_URL"),
    oauthIssuer: process.env.OAUTH_ISSUER ?? apiBaseUrl,
    oauthAudience: process.env.OAUTH_AUDIENCE ?? "openreturn-api",
    oauthTokenSecret:
      process.env.OAUTH_TOKEN_SECRET ?? "development-secret-change-before-production",
    requireAuth: process.env.OPENRETURN_REQUIRE_AUTH === "true",
    smtp: {
      host: optionalEnv("SMTP_HOST"),
      port: Number(process.env.SMTP_PORT ?? 587),
      user: optionalEnv("SMTP_USER"),
      pass: optionalEnv("SMTP_PASS"),
      from: process.env.SMTP_FROM ?? "returns@example.com"
    }
  };
}
