import type { NextFunction, Request, Response } from "express";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import {
  InMemoryReturnRepository,
  NoopNotificationDispatcher,
  OpenReturnError,
  ReturnService,
  validationError,
  type ReturnListFilter
} from "@openreturn/core";
import {
  CARRIER_CODES,
  ProtocolValidationError,
  RESOLUTION_TYPES,
  RETURN_REASON_CODES,
  RETURN_STATES,
  assertAddTrackingRequest,
  assertInitiateReturnRequest,
  assertSelectCarrierRequest,
  assertSelectExchangeRequest,
  assertTokenDelegationRequest,
  assertUpdateReturnRequest,
  assertWebhookEvent,
  type OpenReturnDiscoveryDocument,
  type ReturnState
} from "@openreturn/types";
import {
  createMockCarrierAdapters,
  createMockGenericCommerceAdapters,
  createMockPlatformAdapters,
  type GenericCommerceAdapter,
  type PlatformAdapter
} from "@openreturn/adapters";
import {
  createDefaultReturnMethodRegistry,
  ThirdPartyReturnMethod
} from "@openreturn/return-methods";
import type { ApiConfig } from "./config";
import { carrierApiKey, loadConfig } from "./config";
import { OAuthTokenService, optionalAuth, requireAuth, type AuthenticatedRequest } from "./auth/tokens";
import { PrismaReturnRepository } from "./db/prisma-repository";
import { SmtpNotificationDispatcher } from "./notifications/smtp";
import { openApiDocument } from "./openapi";

interface AppDependencies {
  service?: ReturnService;
  config?: ApiConfig;
  platformAdapters?: PlatformAdapter[];
  genericAdapters?: GenericCommerceAdapter[];
}

type AsyncHandler = (request: Request, response: Response, next: NextFunction) => Promise<void>;

function asyncHandler(handler: AsyncHandler) {
  return (request: Request, response: Response, next: NextFunction): void => {
    handler(request, response, next).catch(next);
  };
}

export function createApp(dependencies: AppDependencies = {}) {
  const config = dependencies.config ?? loadConfig();
  const tokenService = new OAuthTokenService(config);
  const authGuard = (scope: string) =>
    config.requireAuth
      ? requireAuth(tokenService, scope)
      : (_request: Request, _response: Response, next: NextFunction) => next();
  const carrierAdapters = createMockCarrierAdapters({
    apiKeys: {
      postnl: carrierApiKey(config, "postnl"),
      dhl: carrierApiKey(config, "dhl"),
      ups: carrierApiKey(config, "ups"),
      dpd: carrierApiKey(config, "dpd"),
      budbee: carrierApiKey(config, "budbee")
    },
    labelBaseUrl: `${config.apiBaseUrl}/labels`
  });
  const platformAdapters =
    dependencies.platformAdapters ?? createMockPlatformAdapters({ apiKey: config.adapters.platformApiKey });
  const genericAdapters =
    dependencies.genericAdapters ??
    createMockGenericCommerceAdapters({ apiKey: config.adapters.genericCommerceApiKey });
  const methodRegistry = createDefaultReturnMethodRegistry();
  methodRegistry.register(
    new ThirdPartyReturnMethod({
      id: "customer_to_customer_forwarding",
      displayName: "Customer-to-customer forwarding",
      description: "Hands an eligible return to a third-party forwarding or recommerce service.",
      supportedResolutions: ["refund", "store_credit"],
      requiresCarrier: false,
      thirdPartyProvider: "example-forwarding"
    })
  );

  const repository =
    config.databaseUrl && config.nodeEnv !== "test" && process.env.USE_IN_MEMORY_DB !== "true"
      ? new PrismaReturnRepository()
      : new InMemoryReturnRepository();
  const notifications =
    config.nodeEnv === "test"
      ? new NoopNotificationDispatcher()
      : new SmtpNotificationDispatcher(config);
  const service =
    dependencies.service ??
    new ReturnService({
      repository,
      carriers: carrierAdapters,
      returnMethods: methodRegistry,
      notifications
    });

  const app = express();
  app.disable("x-powered-by");
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));
  app.use(optionalAuth(tokenService));

  app.get("/healthz", (_request, response) => {
    response.json({ ok: true });
  });

  app.get("/openapi.json", (_request, response) => {
    response.json(openApiDocument);
  });
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

  app.get("/.well-known/openreturn", (_request, response) => {
    const discovery: OpenReturnDiscoveryDocument = {
      protocol: "openreturn",
      protocolVersion: "0.1.0",
      apiBaseUrl: config.apiBaseUrl,
      mcp: {
        transport: config.mcpUrl ? "http" : "stdio",
        url: config.mcpUrl,
        tools: [
          "discover_openreturn",
          "lookup_order",
          "list_returns",
          "initiate_return",
          "get_return_status",
          "update_return",
          "select_exchange",
          "select_carrier",
          "get_label",
          "track_return",
          "get_return_events",
          "receive_webhook"
        ]
      },
      oauth: {
        issuer: config.oauthIssuer,
        tokenEndpoint: `${config.apiBaseUrl}/oauth/token`,
        delegationEndpoint: `${config.apiBaseUrl}/oauth/delegate`,
        scopesSupported: ["returns:read", "returns:write", "returns:track", "agent:delegate"]
      },
      capabilities: {
        states: [...RETURN_STATES],
        reasonCodes: [...RETURN_REASON_CODES],
        resolutionTypes: [...RESOLUTION_TYPES],
        carriers: [...CARRIER_CODES],
        returnMethods: methodRegistry.list().map((method) => method.id),
        labelFormats: ["pdf", "png", "zpl"],
        webhooks: true
      }
    };
    response.json(discovery);
  });

  app.get("/.well-known/oauth-authorization-server", (_request, response) => {
    response.json({
      issuer: config.oauthIssuer,
      token_endpoint: `${config.apiBaseUrl}/oauth/token`,
      token_endpoint_auth_methods_supported: ["client_secret_post", "none"],
      grant_types_supported: ["client_credentials", "urn:ietf:params:oauth:grant-type:token-exchange"],
      scopes_supported: ["returns:read", "returns:write", "returns:track", "agent:delegate"]
    });
  });

  app.post("/oauth/token", (request, response) => {
    const clientId = String(request.body.client_id ?? "reference-client");
    const scope = String(request.body.scope ?? "returns:read returns:write returns:track agent:delegate");
    response.json(tokenService.issueClientToken(clientId, scope));
  });

  app.post(
    "/oauth/delegate",
    requireAuth(tokenService, "agent:delegate"),
    (request: AuthenticatedRequest, response) => {
      const body = readBodyRecord(request.body);
      const delegationRequest = {
        subjectToken: body.subjectToken ?? body.subject_token,
        actor: body.actor ?? request.auth?.sub ?? "agent",
        scope: body.scope ?? "returns:read returns:write returns:track",
        audience: body.audience
      };
      assertTokenDelegationRequest(delegationRequest);
      const subject = tokenService.verify(delegationRequest.subjectToken);
      response.json(
        tokenService.issueDelegatedToken(
          subject,
          delegationRequest.actor,
          delegationRequest.scope
        )
      );
    }
  );

  app.get(
    "/orders/:id",
    authGuard("returns:read"),
    asyncHandler(async (request, response) => {
      const adapter = platformAdapters[0] ?? genericAdapters[0];
      if (!adapter) {
        response.status(503).json({ error: { code: "no_platform_adapter", message: "No adapter configured" } });
        return;
      }
      const order = await adapter.lookupOrder(request.params.id, request.query.email?.toString());
      if (!order) {
        response.status(404).json({ error: { code: "not_found", message: "Order not found" } });
        return;
      }
      response.json({ order });
    })
  );

  app.get(
    "/returns",
    authGuard("returns:read"),
    asyncHandler(async (request, response) => {
      const status = request.query.status?.toString();
      const filter: ReturnListFilter = {};
      if (status) {
        if (!RETURN_STATES.includes(status as ReturnState)) {
          throw validationError(`Unsupported return status filter: ${status}`);
        }
        filter.status = status as ReturnState;
      }
      if (request.query.email) {
        filter.email = request.query.email.toString();
      }
      if (request.query.limit) {
        const limit = Number(request.query.limit);
        if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
          throw validationError("limit must be an integer between 1 and 500");
        }
        filter.limit = limit;
      }
      const returns = await service.listReturns(filter);
      response.json({ returns });
    })
  );

  app.post(
    "/returns",
    authGuard("returns:write"),
    asyncHandler(async (request, response) => {
      const body: unknown = request.body;
      assertInitiateReturnRequest(body);
      const record = await service.initiateReturn(body);
      response.status(201).json({ return: record });
    })
  );

  app.get(
    "/returns/:id",
    authGuard("returns:read"),
    asyncHandler(async (request, response) => {
      const record = await service.getReturn(request.params.id);
      response.json({ return: record });
    })
  );

  app.put(
    "/returns/:id",
    authGuard("returns:write"),
    asyncHandler(async (request, response) => {
      const body: unknown = request.body;
      assertUpdateReturnRequest(body);
      const record = await service.updateReturn(request.params.id, body);
      response.json({ return: record });
    })
  );

  app.post(
    "/returns/:id/exchange",
    authGuard("returns:write"),
    asyncHandler(async (request, response) => {
      const body: unknown = request.body;
      assertSelectExchangeRequest(body);
      const record = await service.selectExchange(request.params.id, body);
      response.json({ return: record });
    })
  );

  app.post(
    "/returns/:id/carrier",
    authGuard("returns:write"),
    asyncHandler(async (request, response) => {
      const body: unknown = request.body;
      assertSelectCarrierRequest(body);
      const record = await service.selectCarrier(request.params.id, body);
      response.json({ return: record });
    })
  );

  app.get(
    "/returns/:id/label",
    authGuard("returns:read"),
    asyncHandler(async (request, response) => {
      const label = await service.getLabel(request.params.id);
      response.json({ label });
    })
  );

  app.post(
    "/returns/:id/track",
    authGuard("returns:track"),
    asyncHandler(async (request, response) => {
      const body: unknown = request.body;
      assertAddTrackingRequest(body);
      const record = await service.addTracking(request.params.id, body);
      response.json({ return: record });
    })
  );

  app.get(
    "/returns/:id/events",
    authGuard("returns:read"),
    asyncHandler(async (request, response) => {
      const events = await service.getEvents(request.params.id);
      response.json({ events });
    })
  );

  app.post(
    "/webhooks",
    authGuard("returns:track"),
    asyncHandler(async (request, response) => {
      const body: unknown = request.body;
      assertWebhookEvent(body);
      const record = await service.receiveWebhook(body);
      response.status(202).json({ accepted: true, return: record });
    })
  );

  app.get("/labels/:carrier/:serviceLevel/:trackingNumber", (request, response) => {
    sendMockLabel(response, request.params.carrier, request.params.trackingNumber);
  });

  app.get("/labels/:carrier/:trackingNumber", (request, response) => {
    sendMockLabel(response, request.params.carrier, request.params.trackingNumber);
  });

  function sendMockLabel(response: Response, carrier: string, trackingNumber: string): void {
    response
      .type("application/pdf")
      .send(`%PDF-1.4\n% OpenReturn mock label ${carrier}/${trackingNumber}\n`);
  }

  app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
    if (error instanceof OpenReturnError) {
      response.status(error.statusCode).json({
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      });
      return;
    }
    if (error instanceof ProtocolValidationError) {
      response.status(400).json({
        error: {
          code: error.code,
          message: error.message,
          details: error.issues
        }
      });
      return;
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    response.status(500).json({ error: { code: "internal_error", message } });
  });

  return app;
}

function readBodyRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
