import type { ErpCode, Order, ReturnItem } from "@openreturn/types";
import { AdapterError } from "../errors";

/** Configuration for headless commerce and ERP mock adapters. */
export interface GenericCommerceAdapterConfig {
  apiKey: string;
  endpoint?: string;
}

/** Generic commerce/ERP contract for order lookup and return synchronization. */
export interface GenericCommerceAdapter {
  readonly code: ErpCode | string;
  readonly name: string;
  lookupOrder(orderId: string, email?: string): Promise<Order | null>;
  createReturnAuthorization(orderId: string, items: ReturnItem[]): Promise<string>;
  syncReturnStatus(returnId: string, status: string): Promise<void>;
}

/** Stateful mock base class for headless commerce and ERP integrations. */
export abstract class MockGenericCommerceAdapter implements GenericCommerceAdapter {
  public abstract readonly code: ErpCode | string;
  public abstract readonly name: string;
  private readonly authorizations = new Map<string, string>();
  private readonly syncedStatuses = new Map<string, string>();

  public constructor(private readonly config: GenericCommerceAdapterConfig) {}

  /** Looks up a mock order unless the id is empty or starts with MISSING. */
  public async lookupOrder(orderId: string, email = "customer@example.com"): Promise<Order | null> {
    this.assertConfigured();
    if (!orderId || orderId.toUpperCase().startsWith("MISSING")) {
      return null;
    }
    const normalizedEmail =
      typeof email === "string" && email.trim().length > 0
        ? email.toLowerCase()
        : "customer@example.com";
    return {
      id: orderId,
      externalOrderId: `${String(this.code).toUpperCase()}-${orderId}`,
      customer: {
        email: normalizedEmail,
        name: "Headless Reference Customer",
        shippingAddress: {
          name: "Headless Reference Customer",
          line1: "Singel 10",
          city: "Amsterdam",
          postalCode: "1015AB",
          countryCode: "NL"
        }
      },
      items: [
        {
          id: "line_1",
          sku: `${String(this.code).toUpperCase()}-SKU-1`,
          name: "Generic catalog item",
          quantity: 1,
          unitPrice: { amount: 4200, currency: "EUR" },
          attributes: { sourceEndpoint: this.config.endpoint ?? "mock" }
        }
      ],
      total: { amount: 4200, currency: "EUR" },
      placedAt: new Date().toISOString(),
      platform: this.code
    };
  }

  /** Creates or returns an idempotent mock return authorization for an order. */
  public async createReturnAuthorization(orderId: string, items: ReturnItem[]): Promise<string> {
    this.assertConfigured();
    if (typeof orderId !== "string" || orderId.trim().length === 0) {
      throw new AdapterError(
        "invalid_authorization_request",
        "orderId is required to create a return authorization"
      );
    }
    if (!Array.isArray(items) || items.length === 0) {
      throw new AdapterError(
        "invalid_authorization_request",
        "At least one return item is required to create a return authorization"
      );
    }
    const existing = this.authorizations.get(orderId);
    if (existing) {
      return existing;
    }
    const authorization = `${String(this.code).toUpperCase()}-RMA-${orderId}`;
    this.authorizations.set(orderId, authorization);
    return authorization;
  }

  /** Records a mock outbound return status sync. */
  public async syncReturnStatus(returnId: string, status: string): Promise<void> {
    this.assertConfigured();
    if (
      typeof returnId !== "string" ||
      returnId.trim().length === 0 ||
      typeof status !== "string" ||
      status.trim().length === 0
    ) {
      throw new AdapterError(
        "invalid_return_sync",
        "returnId and status are required to sync a return"
      );
    }
    this.syncedStatuses.set(returnId, status);
  }

  private assertConfigured(): void {
    if (!this.config.apiKey) {
      throw new AdapterError("missing_api_key", `${this.name} API key is required`);
    }
  }
}

/** Headless commerce mock adapter. */
export class HeadlessCommerceAdapter extends MockGenericCommerceAdapter {
  public readonly code = "headless";
  public readonly name = "Headless Commerce";

  public constructor(config: GenericCommerceAdapterConfig) {
    super(config);
  }
}

/** Exact ERP mock adapter. */
export class ExactErpAdapter extends MockGenericCommerceAdapter {
  public readonly code = "exact";
  public readonly name = "Exact";

  public constructor(config: GenericCommerceAdapterConfig) {
    super(config);
  }
}

/** SAP ERP mock adapter. */
export class SapErpAdapter extends MockGenericCommerceAdapter {
  public readonly code = "sap";
  public readonly name = "SAP";

  public constructor(config: GenericCommerceAdapterConfig) {
    super(config);
  }
}

/** Microsoft Dynamics mock adapter. */
export class DynamicsErpAdapter extends MockGenericCommerceAdapter {
  public readonly code = "dynamics";
  public readonly name = "Microsoft Dynamics";

  public constructor(config: GenericCommerceAdapterConfig) {
    super(config);
  }
}

/** Creates every built-in generic commerce and ERP adapter with shared configuration. */
export function createMockGenericCommerceAdapters(
  config: GenericCommerceAdapterConfig
): GenericCommerceAdapter[] {
  return [
    new HeadlessCommerceAdapter(config),
    new ExactErpAdapter(config),
    new SapErpAdapter(config),
    new DynamicsErpAdapter(config)
  ];
}
