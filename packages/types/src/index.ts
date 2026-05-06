export const RETURN_STATES = [
  "initiated",
  "label_generated",
  "shipped",
  "in_transit",
  "delivered",
  "inspection",
  "approved",
  "rejected",
  "refunded",
  "exchanged",
  "completed"
] as const;

export type ReturnState = (typeof RETURN_STATES)[number];

export const RETURN_REASON_CODES = [
  "defect",
  "size",
  "not_as_described",
  "wrong_item",
  "arrived_late",
  "damaged_in_transit",
  "duplicate_order",
  "changed_mind",
  "unwanted",
  "other"
] as const;

export type ReturnReasonCode = (typeof RETURN_REASON_CODES)[number];

export const RESOLUTION_TYPES = ["refund", "exchange", "store_credit", "coupon_code"] as const;

export type ResolutionType = (typeof RESOLUTION_TYPES)[number];

export const CARRIER_CODES = ["postnl", "dhl", "ups", "dpd", "budbee"] as const;

export type CarrierCode = (typeof CARRIER_CODES)[number];

export const PLATFORM_CODES = ["shopify", "woocommerce", "magento", "bigcommerce"] as const;

export type PlatformCode = (typeof PLATFORM_CODES)[number];

export const ERP_CODES = ["exact", "sap", "dynamics", "headless"] as const;

export type ErpCode = (typeof ERP_CODES)[number];

export const PAYMENT_PROVIDER_CODES = ["stripe"] as const;

export type PaymentProviderCode = (typeof PAYMENT_PROVIDER_CODES)[number];

export const TRACKING_STATUSES = [
  "label_created",
  "accepted",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "exception"
] as const;

export type TrackingStatus = (typeof TRACKING_STATUSES)[number];

export const RETURN_METHOD_TYPES = ["return-to-warehouse", "exchange", "third_party"] as const;

export type ReturnMethodType = (typeof RETURN_METHOD_TYPES)[number];

export const NOTIFICATION_TYPES = [
  "return_confirmation",
  "label_ready",
  "shipment_received",
  "refund_processed",
  "exchange_completed"
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const EVENT_TYPES = [
  "return.initiated",
  "return.updated",
  "return.exchange_selected",
  "return.carrier_selected",
  "return.label_generated",
  "return.shipped",
  "return.in_transit",
  "return.delivered",
  "return.inspection_started",
  "return.approved",
  "return.rejected",
  "return.refunded",
  "return.exchanged",
  "return.completed",
  "notification.sent",
  "webhook.received"
] as const;

export type ReturnEventType = (typeof EVENT_TYPES)[number];

export interface Money {
  amount: number;
  currency: string;
}

export interface Address {
  name?: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode: string;
  countryCode: string;
}

export interface Customer {
  id?: string;
  email: string;
  name?: string;
  phone?: string;
  shippingAddress?: Address;
}

export interface OrderItem {
  id: string;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: Money;
  imageUrl?: string;
  attributes?: Record<string, string>;
}

export interface Order {
  id: string;
  externalOrderId?: string;
  customer: Customer;
  items: OrderItem[];
  total: Money;
  placedAt: string;
  platform?: PlatformCode | ErpCode | string;
}

export interface ReturnReason {
  code: ReturnReasonCode;
  note?: string;
  evidenceUrls?: string[];
}

export type ReturnItemCondition = "unopened" | "new" | "used" | "defective" | "damaged";

export interface ReturnItem {
  orderItemId: string;
  sku: string;
  name: string;
  quantity: number;
  reason: ReturnReason;
  condition?: ReturnItemCondition;
}

export interface ExchangeItem {
  originalOrderItemId: string;
  replacementSku: string;
  replacementName: string;
  quantity: number;
  attributes?: Record<string, string>;
  priceDifference?: Money;
}

export interface ExchangeSelection {
  requestedItems: ExchangeItem[];
  selectedAt: string;
  status: "pending" | "reserved" | "fulfilled" | "cancelled";
}

export interface CarrierSelection {
  carrier: CarrierCode | string;
  serviceLevel?: string;
  dropoffPointId?: string;
  pickupWindow?: {
    startsAt: string;
    endsAt: string;
  };
}

export interface ShippingLabel {
  id: string;
  carrier: CarrierCode | string;
  trackingNumber: string;
  labelUrl: string;
  format: "pdf" | "png" | "zpl";
  expiresAt: string;
  createdAt: string;
}

export interface TrackingEvent {
  id: string;
  carrier: CarrierCode | string;
  trackingNumber: string;
  status: TrackingStatus;
  occurredAt: string;
  location?: string;
  description?: string;
}

export interface InspectionResult {
  inspectedAt: string;
  inspectorId?: string;
  accepted: boolean;
  notes?: string;
  itemConditions?: Record<string, ReturnItemCondition>;
}

export interface RefundResult {
  amount: Money;
  provider: PaymentProviderCode | string;
  transactionId: string;
  processedAt: string;
}

export interface StoreCreditResult {
  amount: Money;
  code: string;
  expiresAt?: string;
  issuedAt: string;
}

export interface CouponCodeResult {
  code: string;
  amount?: Money;
  percentage?: number;
  expiresAt?: string;
  issuedAt: string;
}

export interface ReturnEvent {
  id: string;
  returnId: string;
  type: ReturnEventType;
  state: ReturnState;
  message: string;
  data?: Record<string, unknown>;
  actor?: "consumer" | "retailer" | "carrier" | "system" | "agent";
  createdAt: string;
}

export interface OpenReturnRecord {
  id: string;
  orderId: string;
  externalOrderId?: string;
  customer: Customer;
  status: ReturnState;
  requestedResolution: ResolutionType;
  reasonCodes: ReturnReasonCode[];
  items: ReturnItem[];
  returnMethod: ReturnMethodType | string;
  exchange?: ExchangeSelection;
  carrier?: CarrierSelection;
  label?: ShippingLabel;
  tracking: TrackingEvent[];
  inspection?: InspectionResult;
  refund?: RefundResult;
  storeCredit?: StoreCreditResult;
  couponCode?: CouponCodeResult;
  metadata?: Record<string, unknown>;
  events: ReturnEvent[];
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface InitiateReturnRequest {
  orderId: string;
  externalOrderId?: string;
  customer: Customer;
  items: ReturnItem[];
  requestedResolution: ResolutionType;
  returnMethod?: ReturnMethodType | string;
  metadata?: Record<string, unknown>;
}

export interface InitiateReturnResponse {
  return: OpenReturnRecord;
}

export interface UpdateReturnRequest {
  status?: ReturnState;
  inspection?: InspectionResult;
  refund?: RefundResult;
  storeCredit?: StoreCreditResult;
  couponCode?: CouponCodeResult;
  metadata?: Record<string, unknown>;
}

export interface SelectExchangeRequest {
  requestedItems: ExchangeItem[];
}

export interface SelectCarrierRequest extends CarrierSelection {
  shipFrom?: Address;
  shipTo?: Address;
}

export interface AddTrackingRequest {
  trackingNumber?: string;
  status: TrackingStatus;
  occurredAt?: string;
  location?: string;
  description?: string;
}

export interface WebhookEvent {
  id?: string;
  source: string;
  type: string;
  returnId?: string;
  trackingNumber?: string;
  data: Record<string, unknown>;
  occurredAt?: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  scope: string;
  delegated_subject?: string;
}

export interface TokenDelegationRequest {
  subjectToken: string;
  actor: string;
  scope: string;
  audience?: string;
}

export interface OpenReturnDiscoveryDocument {
  protocol: "openreturn";
  protocolVersion: string;
  apiBaseUrl: string;
  mcp?: {
    transport: "stdio" | "http";
    url?: string;
    tools: string[];
  };
  oauth: {
    issuer: string;
    tokenEndpoint: string;
    delegationEndpoint: string;
    scopesSupported: string[];
  };
  capabilities: {
    states: ReturnState[];
    reasonCodes: ReturnReasonCode[];
    resolutionTypes: ResolutionType[];
    carriers: string[];
    returnMethods: string[];
    labelFormats: ShippingLabel["format"][];
    webhooks: boolean;
  };
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
