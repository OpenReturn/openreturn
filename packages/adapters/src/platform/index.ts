import { randomUUID } from "node:crypto";
import type {
  ExchangeSelection,
  Money,
  Order,
  PlatformCode,
  RefundResult,
  ReturnItem
} from "@openreturn/types";

export interface PlatformAdapterConfig {
  apiKey: string;
  storeUrl?: string;
}

export interface PlatformAdapter {
  readonly code: PlatformCode | string;
  readonly name: string;
  lookupOrder(orderId: string, email?: string): Promise<Order | null>;
  createReturnAuthorization(orderId: string, items: ReturnItem[]): Promise<string>;
  markRefunded(orderId: string, refund: RefundResult): Promise<void>;
  markExchangeRequested(orderId: string, exchange: ExchangeSelection): Promise<void>;
}

const defaultMoney: Money = { amount: 8999, currency: "EUR" };

export abstract class MockPlatformAdapter implements PlatformAdapter {
  public abstract readonly code: PlatformCode | string;
  public abstract readonly name: string;

  protected constructor(protected readonly config: PlatformAdapterConfig) {}

  public async lookupOrder(orderId: string, email = "customer@example.com"): Promise<Order | null> {
    return {
      id: orderId,
      externalOrderId: `${String(this.code).toUpperCase()}-${orderId}`,
      customer: {
        email,
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
          sku: "TSHIRT-BLACK-M",
          name: "Black T-shirt",
          quantity: 1,
          unitPrice: { amount: 2999, currency: "EUR" },
          attributes: { size: "M", color: "Black" }
        },
        {
          id: "line_2",
          sku: "JEANS-STRAIGHT-32",
          name: "Straight Jeans",
          quantity: 1,
          unitPrice: { amount: 6000, currency: "EUR" },
          attributes: { size: "32", color: "Indigo" }
        }
      ],
      total: defaultMoney,
      placedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      platform: this.code
    };
  }

  public async createReturnAuthorization(orderId: string, _items: ReturnItem[]): Promise<string> {
    return `${String(this.code).toUpperCase()}-RMA-${orderId}-${randomUUID().slice(0, 8)}`;
  }

  public async markRefunded(_orderId: string, _refund: RefundResult): Promise<void> {
    return Promise.resolve();
  }

  public async markExchangeRequested(
    _orderId: string,
    _exchange: ExchangeSelection
  ): Promise<void> {
    return Promise.resolve();
  }
}

export class ShopifyPlatformAdapter extends MockPlatformAdapter {
  public readonly code = "shopify";
  public readonly name = "Shopify";
}

export class WooCommercePlatformAdapter extends MockPlatformAdapter {
  public readonly code = "woocommerce";
  public readonly name = "WooCommerce";
}

export class MagentoPlatformAdapter extends MockPlatformAdapter {
  public readonly code = "magento";
  public readonly name = "Magento";
}

export class BigCommercePlatformAdapter extends MockPlatformAdapter {
  public readonly code = "bigcommerce";
  public readonly name = "BigCommerce";
}

export function createMockPlatformAdapters(config: PlatformAdapterConfig): PlatformAdapter[] {
  return [
    new ShopifyPlatformAdapter(config),
    new WooCommercePlatformAdapter(config),
    new MagentoPlatformAdapter(config),
    new BigCommercePlatformAdapter(config)
  ];
}
