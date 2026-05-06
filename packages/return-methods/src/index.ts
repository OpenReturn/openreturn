import type { OpenReturnRecord, ResolutionType, ReturnMethodType } from "@openreturn/types";

export interface ReturnMethodCapability {
  id: ReturnMethodType | string;
  displayName: string;
  description: string;
  supportedResolutions: ResolutionType[];
  requiresCarrier: boolean;
  thirdPartyProvider?: string;
}

export interface ReturnMethodStartResult {
  returnId: string;
  nextStep: "select_carrier" | "select_exchange" | "await_third_party" | "complete";
  instructions?: string;
  metadata?: Record<string, unknown>;
}

export interface ReturnMethodContext {
  returnRecord: OpenReturnRecord;
}

export interface ReturnMethod {
  readonly capability: ReturnMethodCapability;
  canHandle(returnRecord: OpenReturnRecord): boolean;
  start(context: ReturnMethodContext): Promise<ReturnMethodStartResult>;
}

export class ReturnMethodRegistry {
  private readonly methods = new Map<string, ReturnMethod>();

  public register(method: ReturnMethod): void {
    if (this.methods.has(method.capability.id)) {
      throw new Error(`Return method already registered: ${method.capability.id}`);
    }
    this.methods.set(method.capability.id, method);
  }

  public unregister(id: string): void {
    this.methods.delete(id);
  }

  public get(id: string): ReturnMethod | undefined {
    return this.methods.get(id);
  }

  public list(): ReturnMethodCapability[] {
    return [...this.methods.values()].map((method) => method.capability);
  }

  public require(id: string): ReturnMethod {
    const method = this.get(id);
    if (!method) {
      throw new Error(`Unsupported return method: ${id}`);
    }
    return method;
  }
}

export class ReturnToWarehouseMethod implements ReturnMethod {
  public readonly capability: ReturnMethodCapability = {
    id: "return-to-warehouse",
    displayName: "Return to warehouse",
    description: "Generates a carrier label and routes returned items to the retailer warehouse.",
    supportedResolutions: ["refund", "store_credit", "coupon_code"],
    requiresCarrier: true
  };

  public canHandle(returnRecord: OpenReturnRecord): boolean {
    return this.capability.supportedResolutions.includes(returnRecord.requestedResolution);
  }

  public async start(context: ReturnMethodContext): Promise<ReturnMethodStartResult> {
    return {
      returnId: context.returnRecord.id,
      nextStep: "select_carrier",
      instructions: "Select a carrier to generate the warehouse return label."
    };
  }
}

export class ExchangeReturnMethod implements ReturnMethod {
  public readonly capability: ReturnMethodCapability = {
    id: "exchange",
    displayName: "Exchange",
    description: "Reserves replacement products and returns the original items through a carrier.",
    supportedResolutions: ["exchange"],
    requiresCarrier: true
  };

  public canHandle(returnRecord: OpenReturnRecord): boolean {
    return returnRecord.requestedResolution === "exchange";
  }

  public async start(context: ReturnMethodContext): Promise<ReturnMethodStartResult> {
    return {
      returnId: context.returnRecord.id,
      nextStep: "select_exchange",
      instructions: "Select replacement products before choosing a carrier."
    };
  }
}

export class ThirdPartyReturnMethod implements ReturnMethod {
  public readonly capability: ReturnMethodCapability;

  public constructor(capability: ReturnMethodCapability) {
    this.capability = capability;
  }

  public canHandle(returnRecord: OpenReturnRecord): boolean {
    return this.capability.supportedResolutions.includes(returnRecord.requestedResolution);
  }

  public async start(context: ReturnMethodContext): Promise<ReturnMethodStartResult> {
    return {
      returnId: context.returnRecord.id,
      nextStep: this.capability.requiresCarrier ? "select_carrier" : "await_third_party",
      instructions: `Continue with ${this.capability.displayName}.`
    };
  }
}

export function createDefaultReturnMethodRegistry(): ReturnMethodRegistry {
  const registry = new ReturnMethodRegistry();
  registry.register(new ReturnToWarehouseMethod());
  registry.register(new ExchangeReturnMethod());
  return registry;
}
