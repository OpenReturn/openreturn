import { randomUUID } from "node:crypto";
import type {
  Address,
  CarrierCode,
  Customer,
  ReturnItem,
  ShippingLabel,
  TrackingEvent,
  TrackingStatus
} from "@openreturn/types";

export interface CarrierAdapterConfig {
  apiKey: string;
  labelBaseUrl?: string;
  defaultServiceLevel?: string;
}

export interface CreateLabelInput {
  returnId: string;
  orderId: string;
  customer: Customer;
  items: ReturnItem[];
  carrier: CarrierCode | string;
  serviceLevel?: string;
  shipFrom?: Address;
  shipTo?: Address;
}

export interface CarrierAdapter {
  readonly code: CarrierCode | string;
  readonly name: string;
  createLabel(input: CreateLabelInput): Promise<ShippingLabel>;
  trackShipment(trackingNumber: string): Promise<TrackingEvent[]>;
  cancelLabel(labelId: string): Promise<void>;
}

export abstract class MockCarrierAdapter implements CarrierAdapter {
  public abstract readonly code: CarrierCode | string;
  public abstract readonly name: string;

  protected constructor(private readonly config: CarrierAdapterConfig) {}

  public async createLabel(input: CreateLabelInput): Promise<ShippingLabel> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const trackingNumber = `${String(this.code).toUpperCase()}-${input.returnId.slice(0, 8)}`;
    const baseUrl = this.config.labelBaseUrl ?? "https://labels.openreturn.local";

    return {
      id: randomUUID(),
      carrier: this.code,
      trackingNumber,
      labelUrl: `${baseUrl}/${this.code}/${trackingNumber}.pdf`,
      format: "pdf",
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString()
    };
  }

  public async trackShipment(trackingNumber: string): Promise<TrackingEvent[]> {
    return [
      {
        id: randomUUID(),
        carrier: this.code,
        trackingNumber,
        status: "accepted",
        occurredAt: new Date().toISOString(),
        description: `${this.name} accepted the return parcel`
      }
    ];
  }

  public async cancelLabel(_labelId: string): Promise<void> {
    return Promise.resolve();
  }

  protected trackingEvent(trackingNumber: string, status: TrackingStatus): TrackingEvent {
    return {
      id: randomUUID(),
      carrier: this.code,
      trackingNumber,
      status,
      occurredAt: new Date().toISOString()
    };
  }
}

export class PostNLCarrierAdapter extends MockCarrierAdapter {
  public readonly code = "postnl";
  public readonly name = "PostNL";

  public constructor(config: CarrierAdapterConfig) {
    super(config);
  }
}

export class DHLCarrierAdapter extends MockCarrierAdapter {
  public readonly code = "dhl";
  public readonly name = "DHL";

  public constructor(config: CarrierAdapterConfig) {
    super(config);
  }
}

export class UPSCarrierAdapter extends MockCarrierAdapter {
  public readonly code = "ups";
  public readonly name = "UPS";

  public constructor(config: CarrierAdapterConfig) {
    super(config);
  }
}

export class DPDCarrierAdapter extends MockCarrierAdapter {
  public readonly code = "dpd";
  public readonly name = "DPD";

  public constructor(config: CarrierAdapterConfig) {
    super(config);
  }
}

export class BudbeeCarrierAdapter extends MockCarrierAdapter {
  public readonly code = "budbee";
  public readonly name = "Budbee";

  public constructor(config: CarrierAdapterConfig) {
    super(config);
  }
}

export function createMockCarrierAdapters(config: CarrierAdapterConfig): CarrierAdapter[] {
  return [
    new PostNLCarrierAdapter(config),
    new DHLCarrierAdapter(config),
    new UPSCarrierAdapter(config),
    new DPDCarrierAdapter(config),
    new BudbeeCarrierAdapter(config)
  ];
}
