import nodemailer from "nodemailer";
import type { NotificationDispatcher, NotificationMessage } from "@openreturn/core";
import type { ApiConfig } from "../config";

/** SMTP notification dispatcher used by non-test API runs. */
export class SmtpNotificationDispatcher implements NotificationDispatcher {
  private readonly transporter: nodemailer.Transporter;

  public constructor(private readonly config: ApiConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth:
        config.smtp.user && config.smtp.pass
          ? {
              user: config.smtp.user,
              pass: config.smtp.pass
            }
          : undefined
    });
  }

  public async dispatch(message: NotificationMessage): Promise<void> {
    if (!this.config.smtp.host) {
      return;
    }

    await this.transporter.sendMail({
      from: this.config.smtp.from,
      to: message.returnRecord.customer.email,
      subject: message.subject,
      text: message.text,
      html: message.html ?? `<p>${escapeHtml(message.text)}</p>`
    });
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}
