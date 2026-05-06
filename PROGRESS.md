# OpenReturn Phase 2 Progress

## Completed

- Restored the Phase 2 source review across the monorepo: protocol types, core service, adapters, API, MCP server, portal, tests, deployment config, and docs.
- Completed MCP tool behavior around the REST API surface:
  - Tool definitions cover discovery, order lookup, return creation/list/read/update, exchange selection, carrier selection, label lookup, tracking, event history, and webhooks.
  - Tool dispatch validates protocol inputs before calling the API client.
  - The MCP API client now reports structured HTTP/API errors and rejects non-JSON API responses clearly.
  - stdio and HTTP JSON-RPC handling now return parse/internal errors instead of crashing on malformed input.
- Completed API and core edge handling:
  - Fixed generated label URLs by serving `/labels/:carrier/:serviceLevel/:trackingNumber` while retaining the legacy label route.
  - Added runtime validation for inspection, refund, store credit, coupon code, exchange price difference, and money payloads.
  - Enforced required resolution results before completing refund, store credit, and coupon code returns; exchange returns must pass through `exchanged`.
  - Notification dispatch failures no longer fail return operations; failed delivery is recorded in event history.
- Completed portal behavior beyond placeholders:
  - Consumer return flow covers lookup, item/reason capture, refund/exchange/store-credit/coupon selection, exchange reservation, carrier selection, label generation, and status navigation.
  - Retailer dashboard lists analytics, status pipeline, reason distribution, and return records.
  - Return detail page shows status, label metadata, event history, tracking events, and lifecycle operations.
  - Lifecycle operations now handle store credit and coupon code completion in addition to refunds and exchanges.
- Added integration and E2E coverage:
  - API integration tests now cover health, discovery, OpenAPI JSON, OAuth metadata/token/delegation, order lookup, return creation/list/read/update, label metadata/download, tracking, events, exchange flow, webhooks, auth scopes, missing adapters, and validation failures.
  - MCP tests now cover all tool names, validation failures, read tools, mutation tools, id stripping, and webhook dispatch.
  - Protocol/core tests cover structured resolution validation, terminal resolution requirements, and notification failure resilience.
  - Playwright E2E tests now exercise refund and exchange portal return flows against the API and portal dev servers.
- Completed OpenAPI docs:
  - Runtime OpenAPI and `docs/openapi.yaml` now document all REST endpoints, corrected label routes, response bodies, error responses, and protocol schemas.
- Completed follow-up self-review and hardening:
  - Added `SELF_REVIEW.md` with review scope, fixed findings, residual risks, and verification status.
  - Hardened adapter runtime validation so malformed inputs return structured `AdapterError` responses.
  - Prevented in-memory repository `update` from creating missing records.
  - Hid unexpected internal API errors in production responses.
  - Serialized MCP stdio JSON-RPC draining and added `Content-Length` validation.
  - Made portal API helpers resilient to non-JSON responses and forwarded authorization through proxy routes.
  - Fixed TypeScript package output, Prisma client resolution, ESLint/Next compatibility, and Vitest/E2E test collection.
  - Removed tracked TypeScript build-info artifacts and ignored future `*.tsbuildinfo` output.

## Verification Status

Dependency installation is now working from the generated lockfile. Earlier registry attempts against `registry.npmjs.org`, `registry.npmmirror.com`, and `registry.yarnpkg.com` failed with DNS `EAI_AGAIN`; after `node_modules` and `pnpm-lock.yaml` became available, `pnpm install` completed successfully.

Commands run:

- `pnpm install`: passed.
- `pnpm prisma:generate`: passed.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm test`: passed. API integration specs were skipped in this sandbox because local socket listening is prohibited; they run when `listen(2)` is available.
- `pnpm test:e2e`: command passed with an explicit Playwright skip in this sandbox because local socket/IPC listening is prohibited; it runs Playwright normally when local servers can bind.
- `pnpm build`: passed.

## Follow-up For A Networked Environment

- Run API integration and Playwright E2E tests in an environment that permits local socket listening.
- Replace mock adapters with live carrier, commerce, ERP, and payment adapters before production use.

## Commit Status

- Commit is currently blocked by the sandbox mounting `/root/git/openreturn/.git` read-only. `git add` fails with `fatal: Unable to create '/root/git/openreturn/.git/index.lock': Read-only file system`.
