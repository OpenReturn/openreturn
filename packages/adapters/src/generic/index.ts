import type { ErpCode, Order, ReturnItem } from "@openreturn/types";

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

  protected constructor(private readonly config: GenericCommerceAdapterConfig) {}

  public async lookupOrder(orderId: string, email = "customer@example.com"): Promise<Order | null> {
    void this.config;
    return {
      id: orderId,
      customer: { email },
      items: [
        {
          id: "line_1",
          sku: "GENERIC-SKU",
          name: "Generic catalog item",
          quantity: 1,
          unitPrice: { amount: 4200, currency: "EUR" }
        }
      ],
      total: { amount: 4200, currency: "EUR" },
      placedAt: new Date().toISOString(),
      platform: this.code
    };
  }

  public async createReturnAuthorization(orderId: string, _items: ReturnItem[]): Promise<string> {
    return `${String(this.code).toUpperCase()}-RMA-${orderId}`;
  }

  public async syncReturnStatus(_returnId: string, _status: string): Promise<void> {
    return Promise.resolve();
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
