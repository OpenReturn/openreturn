import { Prisma, PrismaClient } from "@prisma/client";
import type { OpenReturnRecord, ReturnEvent } from "@openreturn/types";
import { conflict, notFound, type ReturnListFilter, type ReturnRepository } from "@openreturn/core";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function fromJson(value: Prisma.JsonValue): OpenReturnRecord {
  return value as unknown as OpenReturnRecord;
}

/** Prisma-backed repository for PostgreSQL persistence. */
export class PrismaReturnRepository implements ReturnRepository {
  public constructor(private readonly prisma = new PrismaClient()) {}

  public async create(record: OpenReturnRecord): Promise<OpenReturnRecord> {
    try {
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
        }
      });
    } catch (error) {
      if (isPrismaKnownError(error, "P2002")) {
        throw conflict(`Return already exists: ${record.id}`);
      }
      throw error;
    }
    return record;
  }

  public async findById(id: string): Promise<OpenReturnRecord | null> {
    const record = await this.prisma.returnRecord.findUnique({ where: { id } });
    return record ? fromJson(record.data) : null;
  }

  public async findByTrackingNumber(trackingNumber: string): Promise<OpenReturnRecord | null> {
    const labelRecord = await this.prisma.returnRecord.findFirst({
      where: { labelTrackingNumber: trackingNumber }
    });
    if (labelRecord) {
      return fromJson(labelRecord.data);
    }

    const records = await this.prisma.returnRecord.findMany();
    for (const record of records) {
      const parsed = fromJson(record.data);
      if (parsed.tracking.some((event) => event.trackingNumber === trackingNumber)) {
        return parsed;
      }
    }
    return null;
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
    try {
      await this.prisma.returnRecord.update({
        where: { id: record.id },
        data: {
          status: record.status,
          labelTrackingNumber: record.label?.trackingNumber,
          data: toJson(record),
          updatedAt: new Date(record.updatedAt)
        }
      });
    } catch (error) {
      if (isPrismaKnownError(error, "P2025")) {
        throw notFound(`Return not found: ${record.id}`);
      }
      throw error;
    }
    await this.syncEvents(record);
    return record;
  }

  public async appendEvent(returnId: string, event: ReturnEvent): Promise<OpenReturnRecord> {
    const record = await this.findById(returnId);
    if (!record) {
      throw notFound(`Return not found: ${returnId}`);
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
        },
        create: {
          id: event.id,
          returnId: record.id,
          type: event.type,
          state: event.state,
          message: event.message,
          actor: event.actor,
          data: event.data ? toJson(event.data) : undefined,
          createdAt: new Date(event.createdAt)
        }
      });
    }
  }
}

function isPrismaKnownError(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}
