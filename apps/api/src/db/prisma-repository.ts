import { PrismaClient } from "@prisma/client";
import type { OpenReturnRecord, ReturnEvent } from "@openreturn/types";
import type { ReturnListFilter, ReturnRepository } from "@openreturn/core";

function toJson<T>(value: T): any {
  return JSON.parse(JSON.stringify(value));
}

function fromJson(value: unknown): OpenReturnRecord {
  return value as OpenReturnRecord;
}

export class PrismaReturnRepository implements ReturnRepository {
  public constructor(private readonly prisma = new PrismaClient()) {}

  public async create(record: OpenReturnRecord): Promise<OpenReturnRecord> {
    await this.prisma.returnRecord.create({
      data: {
        id: record.id,
        orderId: record.orderId,
        externalOrderId: record.externalOrderId,
        customerEmail: record.customer.email,
        status: record.status,
        labelTrackingNumber: record.label?.trackingNumber,
        data: toJson(record),
        createdAt: new Date(record.createdAt),
        updatedAt: new Date(record.updatedAt),
        events: {
          create: record.events.map((event) => ({
            id: event.id,
            type: event.type,
            state: event.state,
            message: event.message,
            actor: event.actor,
            data: event.data ? toJson(event.data) : undefined,
            createdAt: new Date(event.createdAt)
          }))
        }
      } as any
    });
    return record;
  }

  public async findById(id: string): Promise<OpenReturnRecord | null> {
    const record = await this.prisma.returnRecord.findUnique({ where: { id } });
    return record ? fromJson(record.data) : null;
  }

  public async findByTrackingNumber(trackingNumber: string): Promise<OpenReturnRecord | null> {
    const record = await this.prisma.returnRecord.findFirst({
      where: {
        OR: [
          { labelTrackingNumber: trackingNumber },
          { data: { path: ["tracking"], array_contains: [{ trackingNumber }] } as any }
        ]
      }
    });
    return record ? fromJson(record.data) : null;
  }

  public async list(filter: ReturnListFilter = {}): Promise<OpenReturnRecord[]> {
    const records = await this.prisma.returnRecord.findMany({
      where: {
        status: filter.status,
        customerEmail: filter.email
      },
      orderBy: { createdAt: "desc" },
      take: filter.limit ?? 100
    });
    return records.map((record) => fromJson(record.data));
  }

  public async update(record: OpenReturnRecord): Promise<OpenReturnRecord> {
    await this.prisma.returnRecord.update({
      where: { id: record.id },
      data: {
        status: record.status,
        labelTrackingNumber: record.label?.trackingNumber,
        data: toJson(record),
        updatedAt: new Date(record.updatedAt)
      }
    });
    await this.syncEvents(record);
    return record;
  }

  public async appendEvent(returnId: string, event: ReturnEvent): Promise<OpenReturnRecord> {
    const record = await this.findById(returnId);
    if (!record) {
      throw new Error(`Return not found: ${returnId}`);
    }
    record.events.push(event);
    record.updatedAt = event.createdAt;
    return this.update(record);
  }

  private async syncEvents(record: OpenReturnRecord): Promise<void> {
    for (const event of record.events) {
      await this.prisma.returnEventRecord.upsert({
        where: { id: event.id },
        update: {
          type: event.type,
          state: event.state,
          message: event.message,
          actor: event.actor,
          data: event.data ? toJson(event.data) : undefined,
          createdAt: new Date(event.createdAt)
        } as any,
        create: {
          id: event.id,
          returnId: record.id,
          type: event.type,
          state: event.state,
          message: event.message,
          actor: event.actor,
          data: event.data ? toJson(event.data) : undefined,
          createdAt: new Date(event.createdAt)
        } as any
      });
    }
  }
}
