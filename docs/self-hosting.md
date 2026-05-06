# Self-hosting OpenReturn

OpenReturn is split into three deployable services:

- `@openreturn/api`: REST API, state machine, persistence, OAuth delegation, discovery, notifications.
- `@openreturn/mcp-server`: MCP wrapper that calls the REST API.
- `@openreturn/portal`: Next.js reference portal that calls the REST API.

## Local development

1. Copy `.env.example` to `.env` and update secrets.
2. Install dependencies with `pnpm install`.
3. Run `pnpm prisma:generate`.
4. Start Postgres, Mailpit, API, MCP, and portal with `docker compose up --build`.

The default local endpoints are:

- Portal: `http://localhost:3000`
- API: `http://localhost:4000`
- Discovery: `http://localhost:4000/.well-known/openreturn`
- API docs: `http://localhost:4000/docs`
- MCP HTTP endpoint: `http://localhost:4100/mcp`
- Mailpit inbox: `http://localhost:8025`

## Production notes

- Set `OAUTH_TOKEN_SECRET` to a high-entropy secret and rotate it through your secret manager.
- Set `OPENRETURN_REQUIRE_AUTH=true` for production and pass OAuth bearer tokens from trusted clients.
- The API validates URL, port, boolean, and signing-secret environment variables at startup and fails fast on invalid production/auth settings.
- Set `DATABASE_URL` to a PostgreSQL database and run `pnpm prisma:migrate` during deployment.
- Configure SMTP through `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM`.
- Keep `OPENRETURN_API_BASE_URL`, `OPENRETURN_PORTAL_BASE_URL`, and `OPENRETURN_MCP_URL` externally reachable because discovery documents advertise these URLs to agents and clients.
- Use retailer-owned carrier, platform, ERP, and payment credentials in the adapter configuration. The bundled defaults are mock credentials for local development only.

## Environment variables

- `OPENRETURN_API_BASE_URL`: externally reachable REST API base URL.
- `OPENRETURN_PORTAL_BASE_URL`: externally reachable portal URL.
- `OPENRETURN_MCP_URL`: MCP HTTP endpoint advertised in discovery.
- `OPENRETURN_REQUIRE_AUTH`: set to `true` to enforce bearer scopes.
- `OAUTH_ISSUER`, `OAUTH_AUDIENCE`, `OAUTH_TOKEN_SECRET`: OAuth token metadata and signing secret.
- `POSTNL_API_KEY`, `DHL_API_KEY`, `UPS_API_KEY`, `DPD_API_KEY`, `BUDBEE_API_KEY`: carrier credentials.
- `PLATFORM_API_KEY`, `GENERIC_COMMERCE_API_KEY`: commerce adapter credentials.
- `STRIPE_SECRET_KEY`: Stripe payment credential.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: notification email settings.
- `USE_IN_MEMORY_DB`: set to `true` for local API runs without PostgreSQL.
