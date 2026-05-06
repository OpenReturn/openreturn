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

export const RETURN_ITEM_CONDITIONS = ["unopened", "new", "used", "defective", "damaged"] as const;

export type ReturnItemCondition = (typeof RETURN_ITEM_CONDITIONS)[number];

export const LABEL_FORMATS = ["pdf", "png", "zpl"] as const;

export type LabelFormat = (typeof LABEL_FORMATS)[number];

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
  format: LabelFormat;
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

export interface LookupOrderRequest {
  orderId: string;
  email?: string;
}

export interface ReturnIdRequest {
  id: string;
}

export interface ListReturnsRequest {
  status?: ReturnState;
  email?: string;
  limit?: number;
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

export interface ProtocolValidationIssue {
  path: string;
  message: string;
}

export class ProtocolValidationError extends Error {
  public readonly code = "validation_error";

  public constructor(
    message: string,
    public readonly issues: ProtocolValidationIssue[]
  ) {
    super(message);
    this.name = "ProtocolValidationError";
  }
}

export function isReturnState(value: unknown): value is ReturnState {
  return isOneOf(RETURN_STATES, value);
}

export function isReturnReasonCode(value: unknown): value is ReturnReasonCode {
  return isOneOf(RETURN_REASON_CODES, value);
}

export function isResolutionType(value: unknown): value is ResolutionType {
  return isOneOf(RESOLUTION_TYPES, value);
}

export function isCarrierCode(value: unknown): value is CarrierCode {
  return isOneOf(CARRIER_CODES, value);
}

export function isTrackingStatus(value: unknown): value is TrackingStatus {
  return isOneOf(TRACKING_STATUSES, value);
}

export function isReturnItemCondition(value: unknown): value is ReturnItemCondition {
  return isOneOf(RETURN_ITEM_CONDITIONS, value);
}

export function isReturnMethodType(value: unknown): value is ReturnMethodType {
  return isOneOf(RETURN_METHOD_TYPES, value);
}

export function assertInitiateReturnRequest(
  value: unknown
): asserts value is InitiateReturnRequest {
  const issues: ProtocolValidationIssue[] = [];
  if (!isRecord(value)) {
    throwValidation("Request body must be an object", [{ path: "$", message: "Expected object" }]);
  }

  requireNonEmptyString(value, "orderId", "$.orderId", issues);
  optionalString(value, "externalOrderId", "$.externalOrderId", issues);
  validateCustomer(value.customer, "$.customer", issues);
  validateReturnItems(value.items, "$.items", issues);
  validateEnum(value.requestedResolution, "$.requestedResolution", "resolution type", isResolutionType, issues);
  optionalString(value, "returnMethod", "$.returnMethod", issues);
  optionalRecord(value, "metadata", "$.metadata", issues);
  throwIfIssues("Invalid initiate return request", issues);
}

export function assertLookupOrderRequest(value: unknown): asserts value is LookupOrderRequest {
  const issues: ProtocolValidationIssue[] = [];
  if (!isRecord(value)) {
    throwValidation("Request body must be an object", [{ path: "$", message: "Expected object" }]);
  }

  requireNonEmptyString(value, "orderId", "$.orderId", issues);
  optionalString(value, "email", "$.email", issues);
  throwIfIssues("Invalid order lookup request", issues);
}

export function assertReturnIdRequest(value: unknown): asserts value is ReturnIdRequest {
  const issues: ProtocolValidationIssue[] = [];
  if (!isRecord(value)) {
    throwValidation("Request body must be an object", [{ path: "$", message: "Expected object" }]);
  }

  requireNonEmptyString(value, "id", "$.id", issues);
  throwIfIssues("Invalid return id request", issues);
}

export function assertListReturnsRequest(value: unknown): asserts value is ListReturnsRequest {
  const issues: ProtocolValidationIssue[] = [];
  if (!isRecord(value)) {
    throwValidation("Request body must be an object", [{ path: "$", message: "Expected object" }]);
  }

  if ("status" in value && value.status !== undefined) {
    validateEnum(value.status, "$.status", "return state", isReturnState, issues);
  }
  optionalString(value, "email", "$.email", issues);
  if ("limit" in value && value.limit !== undefined) {
    if (!Number.isInteger(value.limit) || Number(value.limit) < 1 || Number(value.limit) > 500) {
      issues.push({ path: "$.limit", message: "Expected integer between 1 and 500" });
    }
  }
  throwIfIssues("Invalid return list request", issues);
}

export function assertUpdateReturnRequest(value: unknown): asserts value is UpdateReturnRequest {
  const issues: ProtocolValidationIssue[] = [];
  if (!isRecord(value)) {
    throwValidation("Request body must be an object", [{ path: "$", message: "Expected object" }]);
  }

  const updateKeys = ["status", "inspection", "refund", "storeCredit", "couponCode", "metadata"];
  if (updateKeys.every((key) => value[key] === undefined)) {
    issues.push({ path: "$", message: "At least one update field is required" });
  }
  if ("status" in value) {
    validateEnum(value.status, "$.status", "return state", isReturnState, issues);
  }
  if ("inspection" in value && value.inspection !== undefined) {
    validateInspectionResult(value.inspection, "$.inspection", issues);
  }
  if ("refund" in value && value.refund !== undefined) {
    validateRefundResult(value.refund, "$.refund", issues);
  }
  if ("storeCredit" in value && value.storeCredit !== undefined) {
    validateStoreCreditResult(value.storeCredit, "$.storeCredit", issues);
  }
  if ("couponCode" in value && value.couponCode !== undefined) {
    validateCouponCodeResult(value.couponCode, "$.couponCode", issues);
  }
  optionalRecord(value, "metadata", "$.metadata", issues);
  throwIfIssues("Invalid update return request", issues);
}

export function assertSelectExchangeRequest(
  value: unknown
): asserts value is SelectExchangeRequest {
  const issues: ProtocolValidationIssue[] = [];
  if (!isRecord(value)) {
    throwValidation("Request body must be an object", [{ path: "$", message: "Expected object" }]);
  }

  if (!Array.isArray(value.requestedItems) || value.requestedItems.length === 0) {
    issues.push({ path: "$.requestedItems", message: "At least one exchange item is required" });
  } else {
    value.requestedItems.forEach((item, index) => {
      validateExchangeItem(item, `$.requestedItems[${index}]`, issues);
    });
  }
  throwIfIssues("Invalid exchange selection request", issues);
}

export function assertSelectCarrierRequest(value: unknown): asserts value is SelectCarrierRequest {
  const issues: ProtocolValidationIssue[] = [];
  if (!isRecord(value)) {
    throwValidation("Request body must be an object", [{ path: "$", message: "Expected object" }]);
  }

  requireNonEmptyString(value, "carrier", "$.carrier", issues);
  optionalString(value, "serviceLevel", "$.serviceLevel", issues);
  optionalString(value, "dropoffPointId", "$.dropoffPointId", issues);
  if ("pickupWindow" in value && value.pickupWindow !== undefined) {
    if (!isRecord(value.pickupWindow)) {
      issues.push({ path: "$.pickupWindow", message: "Expected object" });
    } else {
      requireNonEmptyString(value.pickupWindow, "startsAt", "$.pickupWindow.startsAt", issues);
      requireNonEmptyString(value.pickupWindow, "endsAt", "$.pickupWindow.endsAt", issues);
    }
  }
  if ("shipFrom" in value && value.shipFrom !== undefined) {
    validateAddress(value.shipFrom, "$.shipFrom", issues);
  }
  if ("shipTo" in value && value.shipTo !== undefined) {
    validateAddress(value.shipTo, "$.shipTo", issues);
  }
  throwIfIssues("Invalid carrier selection request", issues);
}

export function assertAddTrackingRequest(value: unknown): asserts value is AddTrackingRequest {
  const issues: ProtocolValidationIssue[] = [];
  if (!isRecord(value)) {
    throwValidation("Request body must be an object", [{ path: "$", message: "Expected object" }]);
  }

  optionalString(value, "trackingNumber", "$.trackingNumber", issues);
  validateEnum(value.status, "$.status", "tracking status", isTrackingStatus, issues);
  optionalString(value, "occurredAt", "$.occurredAt", issues);
  optionalString(value, "location", "$.location", issues);
  optionalString(value, "description", "$.description", issues);
  throwIfIssues("Invalid tracking request", issues);
}

export function assertWebhookEvent(value: unknown): asserts value is WebhookEvent {
  const issues: ProtocolValidationIssue[] = [];
  if (!isRecord(value)) {
    throwValidation("Request body must be an object", [{ path: "$", message: "Expected object" }]);
  }

  requireNonEmptyString(value, "source", "$.source", issues);
  requireNonEmptyString(value, "type", "$.type", issues);
  optionalString(value, "id", "$.id", issues);
  optionalString(value, "returnId", "$.returnId", issues);
  optionalString(value, "trackingNumber", "$.trackingNumber", issues);
  optionalString(value, "occurredAt", "$.occurredAt", issues);
  if (!isRecord(value.data)) {
    issues.push({ path: "$.data", message: "Expected object" });
  }
  throwIfIssues("Invalid webhook event", issues);
}

export function assertTokenDelegationRequest(
  value: unknown
): asserts value is TokenDelegationRequest {
  const issues: ProtocolValidationIssue[] = [];
  if (!isRecord(value)) {
    throwValidation("Request body must be an object", [{ path: "$", message: "Expected object" }]);
  }

  requireNonEmptyString(value, "subjectToken", "$.subjectToken", issues);
  requireNonEmptyString(value, "actor", "$.actor", issues);
  requireNonEmptyString(value, "scope", "$.scope", issues);
  optionalString(value, "audience", "$.audience", issues);
  throwIfIssues("Invalid token delegation request", issues);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOneOf<T extends readonly string[]>(values: T, value: unknown): value is T[number] {
  return typeof value === "string" && (values as readonly string[]).includes(value);
}

function requireNonEmptyString(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: ProtocolValidationIssue[]
): void {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    issues.push({ path, message: "Required non-empty string" });
  }
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: ProtocolValidationIssue[]
): void {
  const value = record[key];
  if (value !== undefined && typeof value !== "string") {
    issues.push({ path, message: "Expected string" });
  }
}

function optionalRecord(
  record: Record<string, unknown>,
  key: string,
  path: string,
  issues: ProtocolValidationIssue[]
): void {
  const value = record[key];
  if (value !== undefined && !isRecord(value)) {
    issues.push({ path, message: "Expected object" });
  }
}

function validateEnum<T extends string>(
  value: unknown,
  path: string,
  label: string,
  predicate: (candidate: unknown) => candidate is T,
  issues: ProtocolValidationIssue[]
): void {
  if (!predicate(value)) {
    issues.push({ path, message: `Expected ${label}` });
  }
}

function validateCustomer(
  value: unknown,
  path: string,
  issues: ProtocolValidationIssue[]
): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "Expected object" });
    return;
  }
  optionalString(value, "id", `${path}.id`, issues);
  requireNonEmptyString(value, "email", `${path}.email`, issues);
  optionalString(value, "name", `${path}.name`, issues);
  optionalString(value, "phone", `${path}.phone`, issues);
  if ("shippingAddress" in value && value.shippingAddress !== undefined) {
    validateAddress(value.shippingAddress, `${path}.shippingAddress`, issues);
  }
}

function validateAddress(
  value: unknown,
  path: string,
  issues: ProtocolValidationIssue[]
): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "Expected object" });
    return;
  }
  optionalString(value, "name", `${path}.name`, issues);
  requireNonEmptyString(value, "line1", `${path}.line1`, issues);
  optionalString(value, "line2", `${path}.line2`, issues);
  requireNonEmptyString(value, "city", `${path}.city`, issues);
  optionalString(value, "region", `${path}.region`, issues);
  requireNonEmptyString(value, "postalCode", `${path}.postalCode`, issues);
  requireNonEmptyString(value, "countryCode", `${path}.countryCode`, issues);
}

function validateReturnItems(
  value: unknown,
  path: string,
  issues: ProtocolValidationIssue[]
): void {
  if (!Array.isArray(value) || value.length === 0) {
    issues.push({ path, message: "At least one return item is required" });
    return;
  }
  value.forEach((item, index) => {
    validateReturnItem(item, `${path}[${index}]`, issues);
  });
}

function validateReturnItem(
  value: unknown,
  path: string,
  issues: ProtocolValidationIssue[]
): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "Expected object" });
    return;
  }
  requireNonEmptyString(value, "orderItemId", `${path}.orderItemId`, issues);
  requireNonEmptyString(value, "sku", `${path}.sku`, issues);
  requireNonEmptyString(value, "name", `${path}.name`, issues);
  if (!Number.isInteger(value.quantity) || Number(value.quantity) < 1) {
    issues.push({ path: `${path}.quantity`, message: "Expected integer greater than zero" });
  }
  validateReturnReason(value.reason, `${path}.reason`, issues);
  if ("condition" in value && value.condition !== undefined) {
    validateEnum(value.condition, `${path}.condition`, "return item condition", isReturnItemCondition, issues);
  }
}

function validateReturnReason(
  value: unknown,
  path: string,
  issues: ProtocolValidationIssue[]
): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "Expected object" });
    return;
  }
  validateEnum(value.code, `${path}.code`, "return reason code", isReturnReasonCode, issues);
  optionalString(value, "note", `${path}.note`, issues);
  if ("evidenceUrls" in value && value.evidenceUrls !== undefined) {
    if (!Array.isArray(value.evidenceUrls) || value.evidenceUrls.some((url) => typeof url !== "string")) {
      issues.push({ path: `${path}.evidenceUrls`, message: "Expected array of strings" });
    }
  }
}

function validateExchangeItem(
  value: unknown,
  path: string,
  issues: ProtocolValidationIssue[]
): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "Expected object" });
    return;
  }
  requireNonEmptyString(value, "originalOrderItemId", `${path}.originalOrderItemId`, issues);
  requireNonEmptyString(value, "replacementSku", `${path}.replacementSku`, issues);
  requireNonEmptyString(value, "replacementName", `${path}.replacementName`, issues);
  if (!Number.isInteger(value.quantity) || Number(value.quantity) < 1) {
    issues.push({ path: `${path}.quantity`, message: "Expected integer greater than zero" });
  }
  optionalRecord(value, "attributes", `${path}.attributes`, issues);
  if ("priceDifference" in value && value.priceDifference !== undefined) {
    validateMoney(value.priceDifference, `${path}.priceDifference`, issues);
  }
}

function validateInspectionResult(
  value: unknown,
  path: string,
  issues: ProtocolValidationIssue[]
): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "Expected object" });
    return;
  }
  requireNonEmptyString(value, "inspectedAt", `${path}.inspectedAt`, issues);
  optionalString(value, "inspectorId", `${path}.inspectorId`, issues);
  if (typeof value.accepted !== "boolean") {
    issues.push({ path: `${path}.accepted`, message: "Expected boolean" });
  }
  optionalString(value, "notes", `${path}.notes`, issues);
  if ("itemConditions" in value && value.itemConditions !== undefined) {
    if (!isRecord(value.itemConditions)) {
      issues.push({ path: `${path}.itemConditions`, message: "Expected object" });
      return;
    }
    for (const [key, condition] of Object.entries(value.itemConditions)) {
      validateEnum(
        condition,
        `${path}.itemConditions.${key}`,
        "return item condition",
        isReturnItemCondition,
        issues
      );
    }
  }
}

function validateRefundResult(
  value: unknown,
  path: string,
  issues: ProtocolValidationIssue[]
): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "Expected object" });
    return;
  }
  validateMoney(value.amount, `${path}.amount`, issues);
  requireNonEmptyString(value, "provider", `${path}.provider`, issues);
  requireNonEmptyString(value, "transactionId", `${path}.transactionId`, issues);
  requireNonEmptyString(value, "processedAt", `${path}.processedAt`, issues);
}

function validateStoreCreditResult(
  value: unknown,
  path: string,
  issues: ProtocolValidationIssue[]
): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "Expected object" });
    return;
  }
  validateMoney(value.amount, `${path}.amount`, issues);
  requireNonEmptyString(value, "code", `${path}.code`, issues);
  optionalString(value, "expiresAt", `${path}.expiresAt`, issues);
  requireNonEmptyString(value, "issuedAt", `${path}.issuedAt`, issues);
}

function validateCouponCodeResult(
  value: unknown,
  path: string,
  issues: ProtocolValidationIssue[]
): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "Expected object" });
    return;
  }
  requireNonEmptyString(value, "code", `${path}.code`, issues);
  if ("amount" in value && value.amount !== undefined) {
    validateMoney(value.amount, `${path}.amount`, issues);
  }
  if ("percentage" in value && value.percentage !== undefined && typeof value.percentage !== "number") {
    issues.push({ path: `${path}.percentage`, message: "Expected number" });
  }
  optionalString(value, "expiresAt", `${path}.expiresAt`, issues);
  requireNonEmptyString(value, "issuedAt", `${path}.issuedAt`, issues);
}

function validateMoney(
  value: unknown,
  path: string,
  issues: ProtocolValidationIssue[]
): void {
  if (!isRecord(value)) {
    issues.push({ path, message: "Expected object" });
    return;
  }
  if (!Number.isInteger(value.amount) || Number(value.amount) < 0) {
    issues.push({ path: `${path}.amount`, message: "Expected non-negative integer" });
  }
  const currency = value.currency;
  if (typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency)) {
    issues.push({ path: `${path}.currency`, message: "Expected 3-letter uppercase currency code" });
  }
}

function throwIfIssues(message: string, issues: ProtocolValidationIssue[]): void {
  if (issues.length > 0) {
    throwValidation(message, issues);
  }
}

function throwValidation(message: string, issues: ProtocolValidationIssue[]): never {
  throw new ProtocolValidationError(message, issues);
}
