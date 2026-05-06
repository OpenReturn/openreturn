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
import { AdapterError } from "../errors";

/** Shared configuration accepted by the built-in mock carrier adapters. */
export interface CarrierAdapterConfig {
  apiKey?: string;
  apiKeys?: Partial<Record<CarrierCode, string>>;
  labelBaseUrl?: string;
  defaultServiceLevel?: string;
}

/** Input required to generate a return shipping label. */
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

/** Carrier integration contract used by the core return service. */
export interface CarrierAdapter {
  readonly code: CarrierCode | string;
  readonly name: string;
  createLabel(input: CreateLabelInput): Promise<ShippingLabel>;
  trackShipment(trackingNumber: string): Promise<TrackingEvent[]>;
  cancelLabel(labelId: string): Promise<void>;
}

/** Stateful mock carrier base class that simulates labels, tracking, and cancellation. */
export abstract class MockCarrierAdapter implements CarrierAdapter {
  public abstract readonly code: CarrierCode | string;
  public abstract readonly name: string;
  protected readonly supportedServiceLevels: string[] = ["standard", "express"];

  private readonly labels = new Map<string, ShippingLabel>();
  private readonly cancelledLabels = new Set<string>();

  protected constructor(private readonly config: CarrierAdapterConfig) {}

  /** Generates a mock label after validating credentials, service level, and request shape. */
  public async createLabel(input: CreateLabelInput): Promise<ShippingLabel> {
    this.assertConfigured();
    this.validateLabelInput(input);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
    const serviceLevel = this.resolveServiceLevel(input.serviceLevel);
    const trackingNumber = `${this.trackingPrefix()}-${input.returnId.slice(0, 8)}-${randomUUID()
      .replaceAll("-", "")
      .slice(0, 6)
      .toUpperCase()}`;
    const baseUrl = (this.config.labelBaseUrl ?? "https://labels.openreturn.local").replace(/\/$/, "");

    const label: ShippingLabel = {
      id: randomUUID(),
      carrier: this.code,
      trackingNumber,
      labelUrl: `${baseUrl}/${this.code}/${serviceLevel}/${trackingNumber}.pdf`,
      format: "pdf",
      expiresAt: expiresAt.toISOString(),
      createdAt: now.toISOString()
    };
    this.labels.set(label.id, label);
    return label;
  }

  /** Returns a deterministic mock tracking timeline for known labels. */
  public async trackShipment(trackingNumber: string): Promise<TrackingEvent[]> {
    const label = [...this.labels.values()].find((candidate) => candidate.trackingNumber === trackingNumber);
    if (!label) {
      return [
        {
          id: randomUUID(),
          carrier: this.code,
          trackingNumber,
          status: "exception",
          occurredAt: new Date().toISOString(),
          description: `${this.name} could not find this tracking number`
        }
      ];
    }

    if (this.cancelledLabels.has(label.id)) {
      return [
        {
          id: randomUUID(),
          carrier: this.code,
          trackingNumber,
          status: "exception",
          occurredAt: new Date().toISOString(),
          description: `${this.name} return label was cancelled`
        }
      ];
    }

    const createdAt = new Date(label.createdAt).getTime();
    return [
      {
        id: randomUUID(),
        carrier: this.code,
        trackingNumber,
        status: "label_created",
        occurredAt: new Date(createdAt).toISOString(),
        description: `${this.name} created the return label`
      },
      {
        id: randomUUID(),
        carrier: this.code,
        trackingNumber,
        status: "accepted",
        occurredAt: new Date(createdAt + 2 * 60 * 60 * 1000).toISOString(),
        description: `${this.name} accepted the return parcel`
      },
      {
        id: randomUUID(),
        carrier: this.code,
        trackingNumber,
        status: "in_transit",
        occurredAt: new Date(createdAt + 18 * 60 * 60 * 1000).toISOString(),
        description: `${this.name} is transporting the return parcel`
      }
    ];
  }

  /** Marks an existing mock label as cancelled. */
  public async cancelLabel(labelId: string): Promise<void> {
    if (!this.labels.has(labelId)) {
      throw new AdapterError("label_not_found", `Label not found: ${labelId}`);
    }
    this.cancelledLabels.add(labelId);
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

  protected trackingPrefix(): string {
    return String(this.code).toUpperCase();
  }

  protected resolveServiceLevel(serviceLevel?: string): string {
    const requested = serviceLevel ?? this.config.defaultServiceLevel ?? this.supportedServiceLevels[0];
    if (!requested || !this.supportedServiceLevels.includes(requested)) {
      throw new AdapterError("unsupported_service_level", `${this.name} does not support ${requested}`, {
        supportedServiceLevels: this.supportedServiceLevels
      });
    }
    return requested;
  }

  private assertConfigured(): void {
    const apiKey =
      this.config.apiKeys?.[this.code as CarrierCode] ?? this.config.apiKey ?? this.config.apiKeys?.postnl;
    if (!apiKey) {
      throw new AdapterError("missing_api_key", `${this.name} API key is required`);
    }
  }

  private validateLabelInput(input: CreateLabelInput): void {
    if (!isRecord(input)) {
      throw new AdapterError("invalid_label_request", "Label request must be an object", input);
    }
    if (
      typeof input.returnId !== "string" ||
      input.returnId.trim().length === 0 ||
      typeof input.orderId !== "string" ||
      input.orderId.trim().length === 0
    ) {
      throw new AdapterError("invalid_label_request", "returnId and orderId are required", input);
    }
    if (
      !isRecord(input.customer) ||
      typeof input.customer.email !== "string" ||
      input.customer.email.trim().length === 0
    ) {
      throw new AdapterError("invalid_label_request", "customer.email is required", input);
    }
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new AdapterError("invalid_label_request", "At least one item is required", input);
    }
    for (const item of input.items) {
      if (!isRecord(item) || !Number.isInteger(item.quantity) || Number(item.quantity) < 1) {
        throw new AdapterError("invalid_label_request", "Item quantity must be at least 1", item);
      }
    }
  }
}

/** PostNL mock carrier implementation. */
export class PostNLCarrierAdapter extends MockCarrierAdapter {
  public readonly code = "postnl";
  public readonly name = "PostNL";
  protected override readonly supportedServiceLevels = ["standard", "evening", "pickup-point"];

  public constructor(config: CarrierAdapterConfig) {
    super(config);
  }
}

/** DHL mock carrier implementation. */
export class DHLCarrierAdapter extends MockCarrierAdapter {
  public readonly code = "dhl";
  public readonly name = "DHL";
  protected override readonly supportedServiceLevels = ["standard", "parcelshop", "express"];

  public constructor(config: CarrierAdapterConfig) {
    super(config);
  }
}

/** UPS mock carrier implementation. */
export class UPSCarrierAdapter extends MockCarrierAdapter {
  public readonly code = "ups";
  public readonly name = "UPS";
  protected override readonly supportedServiceLevels = ["standard", "express-saver", "access-point"];

  public constructor(config: CarrierAdapterConfig) {
    super(config);
  }
}

/** DPD mock carrier implementation. */
export class DPDCarrierAdapter extends MockCarrierAdapter {
  public readonly code = "dpd";
  public readonly name = "DPD";
  protected override readonly supportedServiceLevels = ["standard", "pickup", "predict"];

  public constructor(config: CarrierAdapterConfig) {
    super(config);
  }
}

/** Budbee mock carrier implementation with pickup-route tracking simulation. */
export class BudbeeCarrierAdapter extends MockCarrierAdapter {
  public readonly code = "budbee";
  public readonly name = "Budbee";
  protected override readonly supportedServiceLevels = ["box", "home-pickup"];

  public constructor(config: CarrierAdapterConfig) {
    super(config);
  }

  protected override trackingPrefix(): string {
    return "BUDBEE";
  }

  public override async trackShipment(trackingNumber: string): Promise<TrackingEvent[]> {
    const events = await super.trackShipment(trackingNumber);
    if (events.some((event) => event.status === "exception")) {
      return events;
    }
    return [
      ...events,
      {
        id: randomUUID(),
        carrier: this.code,
        trackingNumber,
        status: "out_for_delivery",
        occurredAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        description: "Budbee has assigned the return pickup route"
      }
    ];
  }
}

/** Creates every built-in mock carrier adapter with shared configuration. */
export function createMockCarrierAdapters(config: CarrierAdapterConfig): CarrierAdapter[] {
  return [
    new PostNLCarrierAdapter(config),
    new DHLCarrierAdapter(config),
    new UPSCarrierAdapter(config),
    new DPDCarrierAdapter(config),
    new BudbeeCarrierAdapter(config)
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
