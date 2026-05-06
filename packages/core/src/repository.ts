import type { OpenReturnRecord, ReturnEvent, ReturnState } from "@openreturn/types";

export interface ReturnListFilter {
  status?: ReturnState;
  email?: string;
  limit?: number;
}

export interface ReturnRepository {
  create(record: OpenReturnRecord): Promise<OpenReturnRecord>;
  findById(id: string): Promise<OpenReturnRecord | null>;
  findByTrackingNumber(trackingNumber: string): Promise<OpenReturnRecord | null>;
  list(filter?: ReturnListFilter): Promise<OpenReturnRecord[]>;
  update(record: OpenReturnRecord): Promise<OpenReturnRecord>;
  appendEvent(returnId: string, event: ReturnEvent): Promise<OpenReturnRecord>;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export class InMemoryReturnRepository implements ReturnRepository {
  private readonly records = new Map<string, OpenReturnRecord>();

  public async create(record: OpenReturnRecord): Promise<OpenReturnRecord> {
    this.records.set(record.id, clone(record));
    return clone(record);
  }

  public async findById(id: string): Promise<OpenReturnRecord | null> {
    const record = this.records.get(id);
    return record ? clone(record) : null;
  }

  public async findByTrackingNumber(trackingNumber: string): Promise<OpenReturnRecord | null> {
    for (const record of this.records.values()) {
      if (
        record.label?.trackingNumber === trackingNumber ||
        record.tracking.some((event) => event.trackingNumber === trackingNumber)
      ) {
        return clone(record);
      }
    }
    return null;
  }

  public async list(filter: ReturnListFilter = {}): Promise<OpenReturnRecord[]> {
    let records = [...this.records.values()];
    if (filter.status) {
      records = records.filter((record) => record.status === filter.status);
    }
    if (filter.email) {
      records = records.filter((record) => record.customer.email === filter.email);
    }
    records.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return clone(records.slice(0, filter.limit ?? 100));
  }

  public async update(record: OpenReturnRecord): Promise<OpenReturnRecord> {
    this.records.set(record.id, clone(record));
    return clone(record);
  }

  public async appendEvent(returnId: string, event: ReturnEvent): Promise<OpenReturnRecord> {
    const record = this.records.get(returnId);
    if (!record) {
      throw new Error(`Return not found: ${returnId}`);
    }
    record.events.push(clone(event));
    record.updatedAt = event.createdAt;
    this.records.set(returnId, clone(record));
    return clone(record);
  }
}
