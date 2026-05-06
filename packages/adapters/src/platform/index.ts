import { randomUUID } from "node:crypto";
import type {
  ExchangeSelection,
  Money,
  Order,
  PlatformCode,
  RefundResult,
  ReturnItem
} from "@openreturn/types";
import { AdapterError } from "../errors";

/** Configuration for mock platform adapters. */
export interface PlatformAdapterConfig {
  apiKey: string;
  storeUrl?: string;
}

/** Commerce platform contract for order lookup and return synchronization. */
export interface PlatformAdapter {
  readonly code: PlatformCode | string;
  readonly name: string;
  lookupOrder(orderId: string, email?: string): Promise<Order | null>;
  createReturnAuthorization(orderId: string, items: ReturnItem[]): Promise<string>;
  markRefunded(orderId: string, refund: RefundResult): Promise<void>;
  markExchangeRequested(orderId: string, exchange: ExchangeSelection): Promise<void>;
}

const defaultMoney: Money = { amount: 8999, currency: "EUR" };

/** Stateful mock platform base class for local development and tests. */
export abstract class MockPlatformAdapter implements PlatformAdapter {
  public abstract readonly code: PlatformCode | string;
  public abstract readonly name: string;
  private readonly returnAuthorizations = new Map<string, string>();
  private readonly refunds = new Map<string, RefundResult>();
  private readonly exchanges = new Map<string, ExchangeSelection>();

  public constructor(protected readonly config: PlatformAdapterConfig) {}

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
    const itemSeed = orderId.replace(/[^a-z0-9]/gi, "").slice(-4) || "1001";
    return {
      id: orderId,
      externalOrderId: `${String(this.code).toUpperCase()}-${orderId}`,
      customer: {
        email: normalizedEmail,
        name: "Reference Customer",
        shippingAddress: {
          name: "Reference Customer",
          line1: "Damrak 1",
          city: "Amsterdam",
          postalCode: "1012JS",
          countryCode: "NL"
        }
      },
      items: [
        {
          id: "line_1",
          sku: `TSHIRT-BLACK-M-${itemSeed}`,
          name: "Black T-shirt",
          quantity: 1,
          unitPrice: { amount: 2999, currency: "EUR" },
          imageUrl: this.imageUrl("tshirt-black"),
          attributes: { size: "M", color: "Black", fulfillmentStatus: "fulfilled" }
        },
        {
          id: "line_2",
          sku: `JEANS-STRAIGHT-32-${itemSeed}`,
          name: "Straight Jeans",
          quantity: 1,
          unitPrice: { amount: 6000, currency: "EUR" },
          imageUrl: this.imageUrl("jeans-indigo"),
          attributes: { size: "32", color: "Indigo", fulfillmentStatus: "fulfilled" }
        }
      ],
      total: defaultMoney,
      placedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
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
    const existing = this.returnAuthorizations.get(orderId);
    if (existing) {
      return existing;
    }
    const authorization = `${String(this.code).toUpperCase()}-RMA-${orderId}-${randomUUID().slice(0, 8)}`;
    this.returnAuthorizations.set(orderId, authorization);
    return authorization;
  }

  /** Records that the platform order was marked as refunded. */
  public async markRefunded(orderId: string, refund: RefundResult): Promise<void> {
    this.assertConfigured();
    if (typeof orderId !== "string" || orderId.trim().length === 0) {
      throw new AdapterError("invalid_refund_sync", "orderId is required to mark a refund");
    }
    this.refunds.set(orderId, refund);
  }

  /** Records that the platform order has an exchange request. */
  public async markExchangeRequested(orderId: string, exchange: ExchangeSelection): Promise<void> {
    this.assertConfigured();
    if (typeof orderId !== "string" || orderId.trim().length === 0) {
      throw new AdapterError("invalid_exchange_sync", "orderId is required to mark an exchange");
    }
    this.exchanges.set(orderId, exchange);
  }

  protected imageUrl(slug: string): string {
    const baseUrl = this.config.storeUrl ?? "https://cdn.openreturn.local/reference-store";
    return `${baseUrl.replace(/\/$/, "")}/${slug}.jpg`;
  }

  private assertConfigured(): void {
    if (!this.config.apiKey) {
      throw new AdapterError("missing_api_key", `${this.name} API key is required`);
    }
  }
}

/** Shopify mock platform implementation. */
export class ShopifyPlatformAdapter extends MockPlatformAdapter {
  public readonly code = "shopify";
  public readonly name = "Shopify";

  public constructor(config: PlatformAdapterConfig) {
    super(config);
  }
}

/** WooCommerce mock platform implementation. */
export class WooCommercePlatformAdapter extends MockPlatformAdapter {
  public readonly code = "woocommerce";
  public readonly name = "WooCommerce";

  public constructor(config: PlatformAdapterConfig) {
    super(config);
  }
}

/** Magento mock platform implementation. */
export class MagentoPlatformAdapter extends MockPlatformAdapter {
  public readonly code = "magento";
  public readonly name = "Magento";

  public constructor(config: PlatformAdapterConfig) {
    super(config);
  }
}

/** BigCommerce mock platform implementation. */
export class BigCommercePlatformAdapter extends MockPlatformAdapter {
  public readonly code = "bigcommerce";
  public readonly name = "BigCommerce";

  public constructor(config: PlatformAdapterConfig) {
    super(config);
  }
}

/** Creates every built-in mock platform adapter with shared configuration. */
export function createMockPlatformAdapters(config: PlatformAdapterConfig): PlatformAdapter[] {
  return [
    new ShopifyPlatformAdapter(config),
    new WooCommercePlatformAdapter(config),
    new MagentoPlatformAdapter(config),
    new BigCommercePlatformAdapter(config)
  ];
}
