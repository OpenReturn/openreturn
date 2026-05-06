# Security and self-review notes

This reference implementation is designed to be self-hosted by a retailer. The REST API is the only entry point used by the MCP server and portal.

## Implemented controls

- OAuth token issuance and token delegation endpoints are available at `/oauth/token` and `/oauth/delegate`.
- `OPENRETURN_REQUIRE_AUTH=true` enforces bearer-token scopes on order lookup, return reads, return writes, tracking, and webhooks.
- Discovery metadata advertises OAuth endpoints and supported scopes.
- The API disables `x-powered-by`, uses `helmet`, and enables explicit JSON body limits.
- Request bodies are validated at the protocol boundary with shared `@openreturn/types` validators before they reach the service layer.
- Environment variables are validated at startup, including production/auth checks for weak OAuth signing secrets.
- SMTP notifications are emitted through the core notification dispatcher and appended to return event history.
- Labels are generated through carrier adapters and include expiry metadata.
- Prisma stores full return records as JSONB plus indexed status, email, tracking number, and event rows.

## Review findings fixed during implementation

- Notification emails were initially sent without an auditable `notification.sent` return event. The core service now appends one after each transactional email dispatch.
- REST routes initially ran open-only for local convenience. They now support production scope enforcement through `OPENRETURN_REQUIRE_AUTH`.
- Docker and CI initially expected a lockfile that could not be generated in the restricted build environment. They now use `pnpm install --no-frozen-lockfile`; projects should commit a generated `pnpm-lock.yaml` once dependency resolution is available.
- MCP tools initially cast arguments directly into API requests. They now validate tool inputs and expose lookup, list, update, event, and webhook operations.
- Mock adapters initially returned minimal static data. They now validate inputs, simulate carrier service levels, tracking timelines, cancellation, platform authorizations, and Stripe idempotency.

## Residual work before production use

- Replace mock carrier, platform, ERP, and payment adapter logic with retailer-owned live credentials.
- Add webhook signature verification for live carrier/platform integrations.
- Store OAuth signing keys in a managed secret store and rotate them regularly.
- Add rate limiting and request logging at the ingress/API gateway layer.
- Generate and commit a `pnpm-lock.yaml` in a networked environment.
