import { randomUUID } from "node:crypto";
import type {
  AddTrackingRequest,
  InitiateReturnRequest,
  OpenReturnRecord,
  ReturnEvent,
  ReturnEventType,
  ReturnState,
  SelectCarrierRequest,
  SelectExchangeRequest,
  ShippingLabel,
  UpdateReturnRequest,
  WebhookEvent
} from "@openreturn/types";
import type { CarrierAdapter } from "@openreturn/adapters";
import type { ReturnMethodRegistry } from "@openreturn/return-methods";
import {
  assertTransition,
  eventTypeForState,
  stateForTrackingStatus
} from "./state-machine";
import type { NotificationDispatcher } from "./notifications";
import { buildNotificationMessage, NoopNotificationDispatcher } from "./notifications";
import type { ReturnListFilter, ReturnRepository } from "./repository";
import { conflict, notFound, validationError } from "./errors";

export interface ReturnServiceOptions {
  repository: ReturnRepository;
  carriers: CarrierAdapter[];
  returnMethods: ReturnMethodRegistry;
  notifications?: NotificationDispatcher;
}

export class ReturnService {
  private readonly repository: ReturnRepository;
  private readonly carriers: Map<string, CarrierAdapter>;
  private readonly returnMethods: ReturnMethodRegistry;
  private readonly notifications: NotificationDispatcher;

  public constructor(options: ReturnServiceOptions) {
    this.repository = options.repository;
    this.carriers = new Map(options.carriers.map((carrier) => [String(carrier.code), carrier]));
    this.returnMethods = options.returnMethods;
    this.notifications = options.notifications ?? new NoopNotificationDispatcher();
  }

  public async initiateReturn(request: InitiateReturnRequest): Promise<OpenReturnRecord> {
    this.validateInitiateRequest(request);
    const now = new Date().toISOString();
    const id = randomUUID();
    const returnMethod = request.returnMethod ?? this.defaultMethodForResolution(request.requestedResolution);
    const method = this.returnMethods.require(returnMethod);
    const reasonCodes = [...new Set(request.items.map((item) => item.reason.code))];

    const record: OpenReturnRecord = {
      id,
      orderId: request.orderId,
      status: "initiated",
      requestedResolution: request.requestedResolution,
      reasonCodes,
      customer: request.customer,
      items: request.items,
      returnMethod,
      tracking: [],
      events: [],
      createdAt: now,
      updatedAt: now
    };

    if (request.externalOrderId) {
      record.externalOrderId = request.externalOrderId;
    }
    if (request.metadata) {
      record.metadata = request.metadata;
    }

    if (!method.canHandle(record)) {
      throw validationError(`Return method ${returnMethod} cannot handle ${request.requestedResolution}`);
    }

    record.events.push(
      this.createEvent(record, "return.initiated", "Return request initiated", "consumer")
    );

    const saved = await this.repository.create(record);
    return this.notify("return_confirmation", saved);
  }

  public async listReturns(filter?: ReturnListFilter): Promise<OpenReturnRecord[]> {
    return this.repository.list(filter);
  }

  public async getReturn(id: string): Promise<OpenReturnRecord> {
    const record = await this.repository.findById(id);
    if (!record) {
      throw notFound(`Return not found: ${id}`);
    }
    return record;
  }

  public async updateReturn(id: string, request: UpdateReturnRequest): Promise<OpenReturnRecord> {
    const record = await this.getReturn(id);
    let next = { ...record, updatedAt: new Date().toISOString() };

    if (request.status) {
      assertTransition(record.status, request.status);
      next.status = request.status;
      if (request.status === "completed") {
        next.completedAt = next.updatedAt;
      }
      next.events = [
        ...record.events,
        this.createEvent(next, eventTypeForState(request.status), `Return moved to ${request.status}`)
      ];
    }

    if (request.inspection) {
      next.inspection = request.inspection;
    }
    if (request.refund) {
      next.refund = request.refund;
    }
    if (request.storeCredit) {
      next.storeCredit = request.storeCredit;
    }
    if (request.couponCode) {
      next.couponCode = request.couponCode;
    }
    if (request.metadata) {
      next.metadata = { ...(record.metadata ?? {}), ...request.metadata };
    }

    next = await this.repository.update(next);
    if (next.status === "refunded") {
      next = await this.notify("refund_processed", next);
    }
    if (next.status === "exchanged") {
      next = await this.notify("exchange_completed", next);
    }
    return next;
  }

  public async selectExchange(
    id: string,
    request: SelectExchangeRequest
  ): Promise<OpenReturnRecord> {
    const record = await this.getReturn(id);
    if (record.requestedResolution !== "exchange") {
      throw conflict("Exchange selection is only valid for exchange returns");
    }
    if (request.requestedItems.length === 0) {
      throw validationError("At least one exchange item is required");
    }

    const now = new Date().toISOString();
    const next: OpenReturnRecord = {
      ...record,
      exchange: {
        requestedItems: request.requestedItems,
        selectedAt: now,
        status: "reserved"
      },
      events: [
        ...record.events,
        this.createEvent(record, "return.exchange_selected", "Exchange items selected", "consumer", {
          requestedItems: request.requestedItems
        })
      ],
      updatedAt: now
    };

    return this.repository.update(next);
  }

  public async selectCarrier(id: string, request: SelectCarrierRequest): Promise<OpenReturnRecord> {
    const record = await this.getReturn(id);
    if (record.status !== "initiated") {
      assertTransition(record.status, "label_generated");
    }
    const carrier = this.carriers.get(String(request.carrier));
    if (!carrier) {
      throw validationError(`Unsupported carrier: ${request.carrier}`);
    }
    if (record.requestedResolution === "exchange" && !record.exchange) {
      throw validationError("Exchange returns require exchange selection before carrier selection");
    }

    const label = await carrier.createLabel({
      returnId: record.id,
      orderId: record.orderId,
      customer: record.customer,
      items: record.items,
      carrier: request.carrier,
      serviceLevel: request.serviceLevel,
      shipFrom: request.shipFrom,
      shipTo: request.shipTo
    });
    const now = new Date().toISOString();
    const next: OpenReturnRecord = {
      ...record,
      status: "label_generated",
      carrier: {
        carrier: request.carrier,
        serviceLevel: request.serviceLevel,
        dropoffPointId: request.dropoffPointId,
        pickupWindow: request.pickupWindow
      },
      label,
      events: [
        ...record.events,
        this.createEvent(record, "return.carrier_selected", "Carrier selected", "consumer", {
          carrier: request.carrier
        }),
        this.createEvent(
          { ...record, status: "label_generated" },
          "return.label_generated",
          "Shipping label generated"
        )
      ],
      updatedAt: now
    };

    const saved = await this.repository.update(next);
    return this.notify("label_ready", saved);
  }

  public async getLabel(id: string): Promise<ShippingLabel> {
    const record = await this.getReturn(id);
    if (!record.label) {
      throw notFound(`Return label is not available for ${id}`);
    }
    return record.label;
  }

  public async addTracking(id: string, request: AddTrackingRequest): Promise<OpenReturnRecord> {
    const record = await this.getReturn(id);
    const trackingNumber = request.trackingNumber ?? record.label?.trackingNumber;
    if (!trackingNumber) {
      throw validationError("trackingNumber is required before a label exists");
    }
    const targetState = stateForTrackingStatus(request.status);
    assertTransition(record.status, targetState);

    const now = new Date().toISOString();
    const trackingEvent = {
      id: randomUUID(),
      carrier: record.carrier?.carrier ?? record.label?.carrier ?? "unknown",
      trackingNumber,
      status: request.status,
      occurredAt: request.occurredAt ?? now,
      location: request.location,
      description: request.description
    };
    const next: OpenReturnRecord = {
      ...record,
      status: targetState,
      tracking: [...record.tracking, trackingEvent],
      events: [
        ...record.events,
        this.createEvent(
          { ...record, status: targetState },
          eventTypeForState(targetState),
          `Tracking update: ${request.status}`,
          "carrier",
          { trackingNumber, status: request.status }
        )
      ],
      updatedAt: now
    };

    const saved = await this.repository.update(next);
    if (targetState === "delivered") {
      return this.notify("shipment_received", saved);
    }
    return saved;
  }

  public async getEvents(id: string): Promise<ReturnEvent[]> {
    const record = await this.getReturn(id);
    return record.events;
  }

  public async receiveWebhook(event: WebhookEvent): Promise<OpenReturnRecord | null> {
    const record = event.returnId
      ? await this.repository.findById(event.returnId)
      : event.trackingNumber
        ? await this.repository.findByTrackingNumber(event.trackingNumber)
        : null;

    if (!record) {
      return null;
    }

    const status = typeof event.data.status === "string" ? event.data.status : undefined;
    if (
      status === "label_created" ||
      status === "accepted" ||
      status === "in_transit" ||
      status === "out_for_delivery" ||
      status === "delivered" ||
      status === "exception"
    ) {
      return this.addTracking(record.id, {
        trackingNumber: event.trackingNumber,
        status,
        occurredAt: event.occurredAt,
        description: event.type
      });
    }

    const webhookEvent = this.createEvent(
      record,
      "webhook.received",
      `Webhook received from ${event.source}`,
      "system",
      { source: event.source, type: event.type, data: event.data }
    );
    return this.repository.update({
      ...record,
      events: [...record.events, webhookEvent],
      updatedAt: webhookEvent.createdAt
    });
  }

  private validateInitiateRequest(request: InitiateReturnRequest): void {
    if (!request.orderId) {
      throw validationError("orderId is required");
    }
    if (!request.customer.email) {
      throw validationError("customer.email is required");
    }
    if (request.items.length === 0) {
      throw validationError("At least one return item is required");
    }
    for (const item of request.items) {
      if (item.quantity < 1) {
        throw validationError("Return item quantity must be at least 1", item);
      }
    }
  }

  private defaultMethodForResolution(resolution: string): string {
    return resolution === "exchange" ? "exchange" : "return-to-warehouse";
  }

  private createEvent(
    record: OpenReturnRecord,
    type: ReturnEventType,
    message: string,
    actor: ReturnEvent["actor"] = "system",
    data?: Record<string, unknown>
  ): ReturnEvent {
    const event: ReturnEvent = {
      id: randomUUID(),
      returnId: record.id,
      type,
      state: record.status,
      message,
      actor,
      createdAt: new Date().toISOString()
    };
    if (data) {
      event.data = data;
    }
    return event;
  }

  private async notify(
    type: Parameters<typeof buildNotificationMessage>[0],
    record: OpenReturnRecord
  ): Promise<OpenReturnRecord> {
    await this.notifications.dispatch(buildNotificationMessage(type, record));
    return this.repository.appendEvent(
      record.id,
      this.createEvent(record, "notification.sent", `Notification sent: ${type}`, "system", {
        notificationType: type
      })
    );
  }
}
