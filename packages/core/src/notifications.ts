import type { NotificationType, OpenReturnRecord } from "@openreturn/types";

export interface NotificationMessage {
  type: NotificationType;
  returnRecord: OpenReturnRecord;
  subject: string;
  text: string;
  html?: string;
}

export interface NotificationDispatcher {
  dispatch(message: NotificationMessage): Promise<void>;
}

export class NoopNotificationDispatcher implements NotificationDispatcher {
  public readonly sent: NotificationMessage[] = [];

  public async dispatch(message: NotificationMessage): Promise<void> {
    this.sent.push(message);
  }
}

export function buildNotificationMessage(
  type: NotificationType,
  returnRecord: OpenReturnRecord
): NotificationMessage {
  const id = returnRecord.id;
  switch (type) {
    case "return_confirmation":
      return {
        type,
        returnRecord,
        subject: `Return ${id} received`,
        text: `We received your return request for order ${returnRecord.orderId}.`
      };
    case "label_ready":
      return {
        type,
        returnRecord,
        subject: `Return label ready for ${id}`,
        text: `Your return label is ready: ${returnRecord.label?.labelUrl ?? "not available"}.`
      };
    case "shipment_received":
      return {
        type,
        returnRecord,
        subject: `Return shipment received for ${id}`,
        text: `Your return shipment has been delivered and is ready for inspection.`
      };
    case "refund_processed":
      return {
        type,
        returnRecord,
        subject: `Refund processed for ${id}`,
        text: `Your refund has been processed.`
      };
    case "exchange_completed":
      return {
        type,
        returnRecord,
        subject: `Exchange completed for ${id}`,
        text: `Your exchange has been completed.`
      };
  }
}
