import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Package, Truck, UserRound } from "lucide-react";
import type { OpenReturnRecord, ReturnEvent } from "@openreturn/types";
import { apiFetch } from "../../../lib/api";
import { StatusActions } from "../../../components/StatusActions";

interface PageProps {
  params: { id: string };
}

export default async function ReturnStatusPage({ params }: PageProps) {
  let record: OpenReturnRecord;
  let events: ReturnEvent[];
  try {
    const [returnPayload, eventsPayload] = await Promise.all([
      apiFetch<{ return: OpenReturnRecord }>(`/returns/${params.id}`),
      apiFetch<{ events: ReturnEvent[] }>(`/returns/${params.id}/events`)
    ]);
    record = returnPayload.return;
    events = eventsPayload.events;
  } catch {
    notFound();
  }

  return (
    <div className="grid two-column">
      <section className="panel" aria-labelledby="return-title">
        <div className="page-heading">
          <h1 id="return-title">Return status</h1>
          <p className="muted">{record.id}</p>
        </div>
        <div className="grid">
          <p>
            <span className="status-pill">{record.status.replaceAll("_", " ")}</span>
          </p>
          <dl className="detail-list">
            <div>
              <dt>
                <Package size={16} aria-hidden="true" />
                Order
              </dt>
              <dd>{record.externalOrderId ?? record.orderId}</dd>
            </div>
            <div>
              <dt>
                <UserRound size={16} aria-hidden="true" />
                Customer
              </dt>
              <dd>{record.customer.email}</dd>
            </div>
            <div>
              <dt>
                <ClipboardList size={16} aria-hidden="true" />
                Resolution
              </dt>
              <dd>{record.requestedResolution.replaceAll("_", " ")}</dd>
            </div>
          </dl>
          <div className="mini-list" aria-label="Return items">
            {record.items.map((item) => (
              <span key={item.orderItemId}>
                {item.name}
                <small>
                  {item.quantity} x {item.sku} - {item.reason.code.replaceAll("_", " ")}
                </small>
              </span>
            ))}
          </div>
          {record.label ? (
            <div className="label-meta">
              <span>
                <Truck size={16} aria-hidden="true" />
                {record.label.carrier} {record.label.trackingNumber}
              </span>
              <a href={record.label.labelUrl}>Download {record.label.format.toUpperCase()}</a>
            </div>
          ) : null}
          <div className="toolbar">
            <Link className="button secondary" href="/returns/new">
              Start another return
            </Link>
            <Link className="button secondary" href="/dashboard">
              Retailer dashboard
            </Link>
          </div>
        </div>
      </section>

      <StatusActions initialReturn={record} />

      <section className="panel" aria-labelledby="events-title">
        <h2 id="events-title">Event history</h2>
        <div className="timeline">
          {events.map((event, index) => (
            <article className="timeline-entry" key={event.id}>
              <span className="timeline-index">{index + 1}</span>
              <h3>{event.message}</h3>
              <p className="muted">
                {new Date(event.createdAt).toLocaleString()} - {event.type}
              </p>
            </article>
          ))}
        </div>
      </section>

      {record.tracking.length > 0 ? (
        <section className="panel" aria-labelledby="tracking-title">
          <h2 id="tracking-title">Carrier tracking</h2>
          <div className="timeline">
            {record.tracking.map((event) => (
              <article className="timeline-entry" key={event.id}>
                <h3>{event.status.replaceAll("_", " ")}</h3>
                <p className="muted">
                  {new Date(event.occurredAt).toLocaleString()} - {event.carrier}
                </p>
                {event.description ? <p>{event.description}</p> : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
