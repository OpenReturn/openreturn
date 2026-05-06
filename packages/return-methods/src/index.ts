import type { OpenReturnRecord, ResolutionType, ReturnMethodType } from "@openreturn/types";

/** Advertised capability metadata for a return method. */
export interface ReturnMethodCapability {
  id: ReturnMethodType | string;
  displayName: string;
  description: string;
  supportedResolutions: ResolutionType[];
  requiresCarrier: boolean;
  thirdPartyProvider?: string;
}

/** Result returned when a return method is started for a record. */
export interface ReturnMethodStartResult {
  returnId: string;
  nextStep: "select_carrier" | "select_exchange" | "await_third_party" | "complete";
  instructions?: string;
  metadata?: Record<string, unknown>;
}

/** Context supplied to a return method implementation. */
export interface ReturnMethodContext {
  returnRecord: OpenReturnRecord;
}

/** Extension contract for built-in and third-party return methods. */
export interface ReturnMethod {
  readonly capability: ReturnMethodCapability;
  canHandle(returnRecord: OpenReturnRecord): boolean;
  start(context: ReturnMethodContext): Promise<ReturnMethodStartResult>;
}

/** Registry of available return methods keyed by capability id. */
export class ReturnMethodRegistry {
  private readonly methods = new Map<string, ReturnMethod>();

  /** Registers a method and rejects duplicate ids. */
  public register(method: ReturnMethod): void {
    if (this.methods.has(method.capability.id)) {
      throw new Error(`Return method already registered: ${method.capability.id}`);
    }
    this.methods.set(method.capability.id, method);
  }

  /** Removes a method from the registry. */
  public unregister(id: string): void {
    this.methods.delete(id);
  }

  /** Looks up a registered method by id. */
  public get(id: string): ReturnMethod | undefined {
    return this.methods.get(id);
  }

  /** Lists advertised capabilities for all registered methods. */
  public list(): ReturnMethodCapability[] {
    return [...this.methods.values()].map((method) => method.capability);
  }

  /** Looks up a method by id or throws when unsupported. */
  public require(id: string): ReturnMethod {
    const method = this.get(id);
    if (!method) {
      throw new Error(`Unsupported return method: ${id}`);
    }
    return method;
  }
}

/** Built-in method for warehouse returns that require carrier labels. */
export class ReturnToWarehouseMethod implements ReturnMethod {
  public readonly capability: ReturnMethodCapability = {
    id: "return-to-warehouse",
    displayName: "Return to warehouse",
    description: "Generates a carrier label and routes returned items to the retailer warehouse.",
    supportedResolutions: ["refund", "store_credit", "coupon_code"],
    requiresCarrier: true
  };

  /** Returns whether the requested resolution can be handled by warehouse returns. */
  public canHandle(returnRecord: OpenReturnRecord): boolean {
    return this.capability.supportedResolutions.includes(returnRecord.requestedResolution);
  }

  /** Starts the method and tells the caller to select a carrier. */
  public async start(context: ReturnMethodContext): Promise<ReturnMethodStartResult> {
    return {
      returnId: context.returnRecord.id,
      nextStep: "select_carrier",
      instructions: "Select a carrier to generate the warehouse return label."
    };
  }
}

/** Built-in method for exchange returns. */
export class ExchangeReturnMethod implements ReturnMethod {
  public readonly capability: ReturnMethodCapability = {
    id: "exchange",
    displayName: "Exchange",
    description: "Reserves replacement products and returns the original items through a carrier.",
    supportedResolutions: ["exchange"],
    requiresCarrier: true
  };

  /** Returns whether the record is an exchange return. */
  public canHandle(returnRecord: OpenReturnRecord): boolean {
    return returnRecord.requestedResolution === "exchange";
  }

  /** Starts the method and tells the caller to select replacement items. */
  public async start(context: ReturnMethodContext): Promise<ReturnMethodStartResult> {
    return {
      returnId: context.returnRecord.id,
      nextStep: "select_exchange",
      instructions: "Select replacement products before choosing a carrier."
    };
  }
}

/** Generic third-party method wrapper for extension and demo methods. */
export class ThirdPartyReturnMethod implements ReturnMethod {
  public readonly capability: ReturnMethodCapability;

  public constructor(capability: ReturnMethodCapability) {
    this.capability = capability;
  }

  /** Returns whether the method supports the return's requested resolution. */
  public canHandle(returnRecord: OpenReturnRecord): boolean {
    return this.capability.supportedResolutions.includes(returnRecord.requestedResolution);
  }

  /** Starts the third-party method and reports the next required step. */
  public async start(context: ReturnMethodContext): Promise<ReturnMethodStartResult> {
    return {
      returnId: context.returnRecord.id,
      nextStep: this.capability.requiresCarrier ? "select_carrier" : "await_third_party",
      instructions: `Continue with ${this.capability.displayName}.`
    };
  }
}

/** Creates the default registry with warehouse and exchange methods. */
export function createDefaultReturnMethodRegistry(): ReturnMethodRegistry {
  const registry = new ReturnMethodRegistry();
  registry.register(new ReturnToWarehouseMethod());
  registry.register(new ExchangeReturnMethod());
  return registry;
}
