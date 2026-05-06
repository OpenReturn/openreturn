import type { ErpCode, Order, ReturnItem } from "@openreturn/types";
import { AdapterError } from "../errors";

export interface GenericCommerceAdapterConfig {
  apiKey: string;
  endpoint?: string;
}

export interface GenericCommerceAdapter {
  readonly code: ErpCode | string;
  readonly name: string;
  lookupOrder(orderId: string, email?: string): Promise<Order | null>;
  createReturnAuthorization(orderId: string, items: ReturnItem[]): Promise<string>;
  syncReturnStatus(returnId: string, status: string): Promise<void>;
}

export abstract class MockGenericCommerceAdapter implements GenericCommerceAdapter {
  public abstract readonly code: ErpCode | string;
  public abstract readonly name: string;
  private readonly authorizations = new Map<string, string>();
  private readonly syncedStatuses = new Map<string, string>();

  protected constructor(private readonly config: GenericCommerceAdapterConfig) {}

  public async lookupOrder(orderId: string, email = "customer@example.com"): Promise<Order | null> {
    if (!orderId || orderId.toUpperCase().startsWith("MISSING")) {
      return null;
    }
    return {
      id: orderId,
      externalOrderId: `${String(this.code).toUpperCase()}-${orderId}`,
      customer: {
        email: email.toLowerCase(),
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

  public async createReturnAuthorization(orderId: string, items: ReturnItem[]): Promise<string> {
    if (!orderId) {
      throw new AdapterError("invalid_authorization_request", "orderId is required to create a return authorization");
    }
    if (items.length === 0) {
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

  public async syncReturnStatus(returnId: string, status: string): Promise<void> {
    if (!returnId || !status) {
      throw new AdapterError("invalid_return_sync", "returnId and status are required to sync a return");
    }
    this.syncedStatuses.set(returnId, status);
  }
}

export class HeadlessCommerceAdapter extends MockGenericCommerceAdapter {
  public readonly code = "headless";
  public readonly name = "Headless Commerce";
}

export class ExactErpAdapter extends MockGenericCommerceAdapter {
  public readonly code = "exact";
  public readonly name = "Exact";
}

export class SapErpAdapter extends MockGenericCommerceAdapter {
  public readonly code = "sap";
  public readonly name = "SAP";
}

export class DynamicsErpAdapter extends MockGenericCommerceAdapter {
  public readonly code = "dynamics";
  public readonly name = "Microsoft Dynamics";
}

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
