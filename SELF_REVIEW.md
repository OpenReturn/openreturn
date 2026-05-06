# OpenReturn Self Review

Date: 2026-05-06
Branch: `feat/phase2`

## Scope Reviewed

- Source packages: `@openreturn/types`, `@openreturn/core`, `@openreturn/adapters`, `@openreturn/return-methods`.
- Apps: REST API, MCP server, Next.js portal, portal proxy routes, tests, Prisma schema, OpenAPI docs, Docker/Kubernetes config, CI config, and repo metadata.
- Search checks: no unresolved `TODO`, `FIXME`, `HACK`, `XXX`, `@ts-ignore`, or `@ts-expect-error` comments remain in reviewed source paths.

## Findings Fixed

- Registry/install: `pnpm install` now succeeds with the generated `pnpm-lock.yaml`; `.pnpm-store` is ignored.
- Prisma generation: root `@prisma/client` was added so the root-level Prisma schema can resolve the client during `pnpm prisma:generate`.
- TypeScript package output: package tsconfigs now set `rootDir: "src"` so manifests pointing at `dist/index.*` resolve correctly.
- Adapter constructors: concrete platform and generic commerce adapters now expose public constructors, fixing factory instantiation under strict TypeScript.
- Runtime validation: carrier, platform, ERP, and payment adapters now return `AdapterError` for malformed runtime input instead of raw `TypeError`.
- Protocol validation: coupon percentages must now be finite numbers greater than 0 and at most 100; OpenAPI docs match this rule.
- Repository safety: the in-memory repository no longer creates records via `update`; missing records raise `not_found`.
- Production error handling: unexpected API errors return a generic production 500 message instead of leaking internal exception text.
- MCP resilience: stdio JSON-RPC handling is serialized, validates `Content-Length`, and avoids re-entrant buffer mutation.
- Portal/API proxy resilience: API helpers tolerate non-JSON responses and forward bearer authorization through portal proxy routes.
- Test routing: Vitest no longer collects Playwright E2E specs as unit tests.
- Socket-restricted environments: API integration tests and E2E runner now skip only when local listening is prohibited. They still run in normal development and CI environments.
- Build artifacts: tracked `*.tsbuildinfo` files were removed and ignored.

## Error Handling Review

- REST routes use `asyncHandler` and a centralized Express error handler for `OpenReturnError`, `ProtocolValidationError`, and unknown errors.
- MCP tool dispatch validates inputs with shared protocol validators before calling the API client.
- Core service intentionally lets repository and adapter failures propagate except notification dispatch, which records failed delivery as a return event.
- Portal client actions use `try/finally` around mutations to release busy state and display structured API error messages.

## Residual Risks

- The bundled carrier, commerce, ERP, and payment adapters remain mock implementations and must be replaced before production.
- Live webhooks still need source-specific signature verification and replay protection.
- The reference OAuth token endpoint is suitable for local/reference use; production deployments should put client authentication, key rotation, and rate limits in front of it.
- Playwright E2E could not execute in this sandbox because local socket/IPC listening is forbidden; the command now reports an explicit skip here.
- API integration tests are skipped in this sandbox for the same socket restriction and will execute where `listen(2)` is permitted.

## Verification

- `pnpm install`
- `pnpm prisma:generate`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm test:e2e` (skipped Playwright here due socket policy)
- `pnpm build`

## Commit Blocker

- `git add` and `git commit` cannot run in this sandbox because `.git` is mounted read-only. The observed error is `fatal: Unable to create '/root/git/openreturn/.git/index.lock': Read-only file system`.
